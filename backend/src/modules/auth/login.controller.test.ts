
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response } from "express";

import {
  loginParticipantController,
  type LoginControllerDependencies,
} from "./login.controller.js";

import {
  AuthValidationError,
  InvalidCredentialsError,
} from "./login.service.js";

const PARTICIPANT = {
  id: "17",
  full_name: "Participante de prueba",
  email: "participante@example.com",
};

const SESSION_TOKEN = "a".repeat(64);

const SESSION_EXPIRATION = new Date(
  "2026-10-24T12:00:00.000Z",
);

function createMockResponse() {
  let statusCode = 200;
  let responseBody: unknown;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },

    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => responseBody,
  };
}

function createRequest(body: unknown): Request {
  return { body } as Request;
}

function createSuccessfulDependencies(
  overrides: LoginControllerDependencies = {},
): LoginControllerDependencies {
  return {
    login: async () => PARTICIPANT,

    startSession: async () => ({
      token: SESSION_TOKEN,
      sessionId: "25",
      expiresAt: SESSION_EXPIRATION,
    }),

    setCookie: () => {},

    ...overrides,
  };
}

for (const [description, body] of [
  ["nulo", null],
  ["arreglo", []],
  ["texto", "datos"],
  ["indefinido", undefined],
] as const) {
  test(`Rechaza un body ${description}`, async () => {
    const { res, getStatus, getBody } = createMockResponse();

    let loginCalled = false;

    await loginParticipantController(
      createRequest(body),
      res,
      createSuccessfulDependencies({
        login: async () => {
          loginCalled = true;
          return PARTICIPANT;
        },
      }),
    );

    assert.equal(getStatus(), 400);
    assert.equal(loginCalled, false);

    assert.deepEqual(getBody(), {
      success: false,
      message: "Los datos de inicio de sesión no son válidos.",
    });
  });
}

test("Crea una sesión y establece la cookie cuando el login es correcto", async () => {
  const { res, getStatus, getBody } = createMockResponse();

  let participantIdReceived: string | undefined;
  let cookieTokenReceived: string | undefined;

  await loginParticipantController(
    createRequest({
      email: PARTICIPANT.email,
      password: "Password123!",
    }),
    res,
    createSuccessfulDependencies({
      startSession: async (participantId) => {
        participantIdReceived = participantId;

        return {
          token: SESSION_TOKEN,
          sessionId: "25",
          expiresAt: SESSION_EXPIRATION,
        };
      },

      setCookie: (_res, token) => {
        cookieTokenReceived = token;
      },
    }),
  );

  assert.equal(getStatus(), 200);
  assert.equal(participantIdReceived, PARTICIPANT.id);
  assert.equal(cookieTokenReceived, SESSION_TOKEN);

  assert.deepEqual(getBody(), {
    success: true,
    message: "Inicio de sesión exitoso.",
    data: {
      participant: PARTICIPANT,
      expiresAt: SESSION_EXPIRATION,
    },
  });
});

test("No expone el token ni el hash en la respuesta JSON", async () => {
  const { res, getBody } = createMockResponse();

  await loginParticipantController(
    createRequest({
      email: PARTICIPANT.email,
      password: "Password123!",
    }),
    res,
    createSuccessfulDependencies(),
  );

  const responseText = JSON.stringify(getBody());

  assert.equal(responseText.includes(SESSION_TOKEN), false);
  assert.equal(responseText.includes("tokenHash"), false);
  assert.equal(responseText.includes("sessionId"), false);
});

test("Devuelve 400 cuando los datos son inválidos", async () => {
  const { res, getStatus, getBody } = createMockResponse();

  let sessionCreated = false;

  await loginParticipantController(
    createRequest({
      email: "correo-invalido",
      password: "Password123!",
    }),
    res,
    createSuccessfulDependencies({
      login: async () => {
        throw new AuthValidationError(
          "Debes proporcionar un correo electrónico válido.",
        );
      },

      startSession: async () => {
        sessionCreated = true;

        throw new Error("No debería crear una sesión.");
      },
    }),
  );

  assert.equal(getStatus(), 400);
  assert.equal(sessionCreated, false);

  assert.deepEqual(getBody(), {
    success: false,
    message: "Debes proporcionar un correo electrónico válido.",
  });
});

test("Devuelve 401 cuando las credenciales son incorrectas", async () => {
  const { res, getStatus, getBody } = createMockResponse();

  let sessionCreated = false;

  await loginParticipantController(
    createRequest({
      email: PARTICIPANT.email,
      password: "incorrecta",
    }),
    res,
    createSuccessfulDependencies({
      login: async () => {
        throw new InvalidCredentialsError();
      },

      startSession: async () => {
        sessionCreated = true;

        throw new Error("No debería crear una sesión.");
      },
    }),
  );

  assert.equal(getStatus(), 401);
  assert.equal(sessionCreated, false);

  assert.deepEqual(getBody(), {
    success: false,
    message: "Correo electrónico o contraseña incorrectos.",
  });
});

test("Devuelve 500 cuando falla la creación de la sesión", async () => {
  const { res, getStatus, getBody } = createMockResponse();

  let cookieSet = false;

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await loginParticipantController(
      createRequest({
        email: PARTICIPANT.email,
        password: "Password123!",
      }),
      res,
      createSuccessfulDependencies({
        startSession: async () => {
          throw new Error("Error de base de datos.");
        },

        setCookie: () => {
          cookieSet = true;
        },
      }),
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(getStatus(), 500);
  assert.equal(cookieSet, false);

  assert.deepEqual(getBody(), {
    success: false,
    message: "No fue posible iniciar sesión.",
  });
});

test("Devuelve 500 cuando ocurre un error interno", async () => {
  const { res, getStatus, getBody } = createMockResponse();

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await loginParticipantController(
      createRequest({
        email: PARTICIPANT.email,
        password: "Password123!",
      }),
      res,
      createSuccessfulDependencies({
        login: async () => {
          throw new Error("Error inesperado.");
        },
      }),
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(getStatus(), 500);

  assert.deepEqual(getBody(), {
    success: false,
    message: "No fue posible iniciar sesión.",
  });
});
