
import type { Request, Response } from "express";

import {
  readSessionTokenFromCookie,
  clearSessionCookie,
} from "./sessionCookie.js";

import {
  endParticipantSession,
} from "./sessions.service.js";

type EndSessionFunction = typeof endParticipantSession;
type ClearCookieFunction = typeof clearSessionCookie;

export interface LogoutControllerDependencies {
  endSession?: EndSessionFunction;
  clearCookie?: ClearCookieFunction;
}

export async function logoutParticipantController(
  req: Request,
  res: Response,
  dependencies: LogoutControllerDependencies = {},
): Promise<void> {
  try {
    const token = readSessionTokenFromCookie(req.headers.cookie);

    const endSession =
      dependencies.endSession ?? endParticipantSession;

    const clearCookie =
      dependencies.clearCookie ?? clearSessionCookie;

    if (token) {
      await endSession(token);
    }

    clearCookie(res);

    res.status(200).json({
      success: true,
      message: "Sesión cerrada correctamente.",
    });
  } catch (error) {
    console.error("Error al cerrar sesión:", error);

    res.status(500).json({
      success: false,
      message: "No fue posible cerrar la sesión.",
    });
  }
}
