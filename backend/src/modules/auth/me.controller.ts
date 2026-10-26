
import type { Request, Response } from "express";

import {
  findParticipantById,
} from "./participants.repository.js";

type FindParticipantFunction = typeof findParticipantById;

export interface MeControllerDependencies {
  findParticipant?: FindParticipantFunction;
}

export async function getCurrentParticipantController(
  _req: Request,
  res: Response,
  dependencies: MeControllerDependencies = {},
): Promise<void> {
  try {
    const auth = res.locals.auth as
      | { participantId?: string; sessionId?: string }
      | undefined;

    if (
      !auth ||
      typeof auth.participantId !== "string" ||
      !/^[1-9]\d*$/.test(auth.participantId)
    ) {
      res.status(401).json({
        success: false,
        message: "Debes iniciar sesión para continuar.",
      });

      return;
    }

    const findParticipant =
      dependencies.findParticipant ?? findParticipantById;

    const participant = await findParticipant(auth.participantId);

    if (!participant) {
      res.status(401).json({
        success: false,
        message: "Tu sesión no es válida o ha expirado.",
      });

      return;
    }

    res.status(200).json({
      success: true,
      data: {
        participant,
      },
    });
  } catch (error) {
    console.error(
      "Error al consultar el participante autenticado:",
      error,
    );

    res.status(500).json({
      success: false,
      message: "No fue posible consultar la sesión actual.",
    });
  }
}
