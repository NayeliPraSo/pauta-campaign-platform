
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response } from "express";

import {
  getCurrentParticipantController,
} from "./me.controller.js";

function createMockResponse(
  auth?: unknown,
): Response & {
  statusCode: number;
  body: unknown;
} {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    locals: auth === undefined ? {} : { auth },

    status(code: number) {
      this.statusCode = code;
      return this;
    },

    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

const mockRequest = {} as Request;

test("Devuelve 200 con los datos del participante autenticado", async () => {
  const participant = {
    id: "18",
    full_name: "Participante de Prueba",
    email: "participante.prueba@example.com",
  };

  const res = createMockResponse({
    participantId: "18",
    sessionId: "1",
  });

  let receivedId = "";

  await getCurrentParticipantController(mockRequest, res, {
    findParticipant: async (id) => {
      receivedId = id;
      return participant;
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(receivedId, "18");

  assert.deepEqual(res.body, {
    success: true,
    data: {
      participant,
    },
  });
});

test("Devuelve 401 cuando no existe información de autenticación", async () => {
  const res = createMockResponse();

  await getCurrentParticipantController(mockRequest, res, {
    findParticipant: async () => {
      throw new Error("No debería consultar PostgreSQL");
    },
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: "Debes iniciar sesión para continuar.",
  });
});

test("Rechaza identificadores de participante inválidos", async () => {
  const invalidIds = ["", "0", "-1", "abc", "1.5"];

  for (const participantId of invalidIds) {
    const res = createMockResponse({
      participantId,
      sessionId: "1",
    });

    await getCurrentParticipantController(mockRequest, res, {
      findParticipant: async () => {
        throw new Error("No debería consultar PostgreSQL");
      },
    });

    assert.equal(res.statusCode, 401);
  }
});

test("Devuelve 401 cuando el participante no existe o está inactivo", async () => {
  const res = createMockResponse({
    participantId: "18",
    sessionId: "1",
  });

  await getCurrentParticipantController(mockRequest, res, {
    findParticipant: async () => null,
  });

  assert.equal(res.statusCode, 401);

  assert.deepEqual(res.body, {
    success: false,
    message: "Tu sesión no es válida o ha expirado.",
  });
});

test("No expone contraseñas ni hashes en la respuesta", async () => {
  const res = createMockResponse({
    participantId: "18",
    sessionId: "1",
  });

  await getCurrentParticipantController(mockRequest, res, {
    findParticipant: async () => ({
      id: "18",
      full_name: "Participante de Prueba",
      email: "participante.prueba@example.com",
    }),
  });

  const responseBody = JSON.stringify(res.body);

  assert.doesNotMatch(responseBody, /password_hash/i);
  assert.doesNotMatch(responseBody, /password/i);
  assert.doesNotMatch(responseBody, /token/i);
});

test("Devuelve 500 cuando ocurre un error al consultar PostgreSQL", async () => {
  const res = createMockResponse({
    participantId: "18",
    sessionId: "1",
  });

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await getCurrentParticipantController(mockRequest, res, {
      findParticipant: async () => {
        throw new Error("Error interno de PostgreSQL");
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);

  assert.deepEqual(res.body, {
    success: false,
    message: "No fue posible consultar la sesión actual.",
  });
});
