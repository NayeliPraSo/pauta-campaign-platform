
import type { NextFunction, Request, Response } from "express";

import {
  readSessionTokenFromCookie,
} from "../sessionCookie.js";

import {
  validateParticipantSession,
} from "../sessions.service.js";

type ValidateSessionFunction =
  typeof validateParticipantSession;

export interface RequireAuthDependencies {
  validateSession?: ValidateSessionFunction;
}

export function createRequireAuthMiddleware(
  dependencies: RequireAuthDependencies = {},
) {
  const validateSession =
    dependencies.validateSession ??
    validateParticipantSession;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = readSessionTokenFromCookie(
        req.headers.cookie,
      );

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Debes iniciar sesión para continuar.",
        });
        return;
      }

      const session = await validateSession(token);

      if (!session) {
        res.status(401).json({
          success: false,
          message: "Tu sesión no es válida o ha expirado.",
        });
        return;
      }

      res.locals.auth = {
        participantId: session.participant_id,
        sessionId: session.id,
      };

      next();
    } catch (error) {
      console.error(
        "Error al verificar la sesión:",
        error,
      );

      res.status(500).json({
        success: false,
        message: "No fue posible verificar la sesión.",
      });
    }
  };
}

export const requireAuth =
  createRequireAuthMiddleware();
