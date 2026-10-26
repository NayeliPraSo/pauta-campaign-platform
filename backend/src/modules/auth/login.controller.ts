
import type { Request, Response } from "express";

import {
  AuthValidationError,
  InvalidCredentialsError,
  loginParticipant,
  type LoginParticipantInput,
} from "./login.service.js";

import {
  startParticipantSession,
} from "./sessions.service.js";

import {
  setSessionCookie,
} from "./sessionCookie.js";

type LoginFunction = typeof loginParticipant;
type StartSessionFunction = typeof startParticipantSession;
type SetCookieFunction = typeof setSessionCookie;

export interface LoginControllerDependencies {
  login?: LoginFunction;
  startSession?: StartSessionFunction;
  setCookie?: SetCookieFunction;
}

export async function loginParticipantController(
  req: Request,
  res: Response,
  dependencies: LoginControllerDependencies = {},
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
        message: "Los datos de inicio de sesión no son válidos.",
      });

      return;
    }

    const input: LoginParticipantInput = {
      email: body.email,
      password: body.password,
    };

    const login = dependencies.login ?? loginParticipant;

    const startSession =
      dependencies.startSession ?? startParticipantSession;

    const setCookie =
      dependencies.setCookie ?? setSessionCookie;

    const participant = await login(input);

    const session = await startSession(participant.id);

    setCookie(res, session.token);

    res.status(200).json({
      success: true,
      message: "Inicio de sesión exitoso.",
      data: {
        participant,
        expiresAt: session.expiresAt,
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

    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({
        success: false,
        message: error.message,
      });

      return;
    }

    console.error("Error al iniciar sesión:", error);

    res.status(500).json({
      success: false,
      message: "No fue posible iniciar sesión.",
    });
  }
}
