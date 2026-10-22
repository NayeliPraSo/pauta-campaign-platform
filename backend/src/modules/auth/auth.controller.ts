
import type { Request, Response } from "express";

import {
  AuthValidationError,
  ParticipantAlreadyExistsError,
  registerParticipant,
  type RegisterParticipantInput,
} from "./auth.service.js";

type RegisterFunction = typeof registerParticipant;

export interface AuthControllerDependencies {
  register?: RegisterFunction;
}

export async function registerParticipantController(
  req: Request,
  res: Response,
  dependencies: AuthControllerDependencies = {},
): Promise<void> {
  try {
    const body = req.body;

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      res.status(400).json({
        success: false,
        message: "Los datos del registro no son válidos.",
      });

      return;
    }

    const input: RegisterParticipantInput = {
      full_name: body.full_name,
      email: body.email,
      password: body.password,
      accepted_terms: body.accepted_terms,
      accepted_privacy: body.accepted_privacy,
    };

    const register = dependencies.register ?? registerParticipant;

    const participant = await register(input);

    res.status(201).json({
      success: true,
      message: "Participante registrado correctamente.",
      data: {
        participant,
      },
    });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
      });

      return;
    }

    if (error instanceof ParticipantAlreadyExistsError) {
      res.status(409).json({
        success: false,
        message: error.message,
      });

      return;
    }

    console.error("Error al registrar participante:", error);

    res.status(500).json({
      success: false,
      message: "No fue posible completar el registro.",
    });
  }
}
