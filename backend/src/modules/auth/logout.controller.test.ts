
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response } from "express";

import {
  logoutParticipantController,
} from "./logout.controller.js";

const VALID_TOKEN = "a".repeat(64);

function createMockRequest(
  cookie?: string,
): Request {
  return {
    headers: cookie ? { cookie } : {},
  } as Request;
}

function createMockResponse(): Response & {
  statusCode: number;
  body: unknown;
} {
  const res = {
    statusCode: 200,
    body: undefined as unknown,

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

test("Revoca la sesión y elimina la cookie", async () => {
  const req = createMockRequest(
    `pauta_session=${VALID_TOKEN}`,
  );

  const res = createMockResponse();

  let revokedToken = "";
  let cookieCleared = false;

  await logoutParticipantController(req, res, {
    endSession: async (token) => {
      revokedToken = token;
      return true;
    },

    clearCookie: () => {
      cookieCleared = true;
    },
  });

  assert.equal(revokedToken, VALID_TOKEN);
  assert.equal(cookieCleared, true);
  assert.equal(res.statusCode, 200);

  assert.deepEqual(res.body, {
    success: true,
    message: "Sesión cerrada correctamente.",
  });
});

test("Permite cerrar sesión cuando no existe cookie", async () => {
  const req = createMockRequest();
  const res = createMockResponse();

  let endSessionCalled = false;
  let cookieCleared = false;

  await logoutParticipantController(req, res, {
    endSession: async () => {
      endSessionCalled = true;
      return true;
    },

    clearCookie: () => {
      cookieCleared = true;
    },
  });

  assert.equal(endSessionCalled, false);
  assert.equal(cookieCleared, true);
  assert.equal(res.statusCode, 200);
});

test("Rechaza el token inválido sin intentar revocarlo", async () => {
  const req = createMockRequest(
    "pauta_session=token-invalido",
  );

  const res = createMockResponse();

  let endSessionCalled = false;
  let cookieCleared = false;

  await logoutParticipantController(req, res, {
    endSession: async () => {
      endSessionCalled = true;
      return true;
    },

    clearCookie: () => {
      cookieCleared = true;
    },
  });

  assert.equal(endSessionCalled, false);
  assert.equal(cookieCleared, true);
  assert.equal(res.statusCode, 200);
});

test("Permite cerrar sesión cuando ya fue revocada", async () => {
  const req = createMockRequest(
    `pauta_session=${VALID_TOKEN}`,
  );

  const res = createMockResponse();

  let cookieCleared = false;

  await logoutParticipantController(req, res, {
    endSession: async () => false,

    clearCookie: () => {
      cookieCleared = true;
    },
  });

  assert.equal(cookieCleared, true);
  assert.equal(res.statusCode, 200);
});

test("No expone el token en la respuesta JSON", async () => {
  const req = createMockRequest(
    `pauta_session=${VALID_TOKEN}`,
  );

  const res = createMockResponse();

  await logoutParticipantController(req, res, {
    endSession: async () => true,
    clearCookie: () => {},
  });

  const responseBody = JSON.stringify(res.body);

  assert.equal(responseBody.includes(VALID_TOKEN), false);
  assert.doesNotMatch(responseBody, /token_hash/i);
});

test("Devuelve 500 cuando falla la revocación", async () => {
  const req = createMockRequest(
    `pauta_session=${VALID_TOKEN}`,
  );

  const res = createMockResponse();

  let cookieCleared = false;

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await logoutParticipantController(req, res, {
      endSession: async () => {
        throw new Error("Error de PostgreSQL");
      },

      clearCookie: () => {
        cookieCleared = true;
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);
  assert.equal(cookieCleared, false);

  assert.deepEqual(res.body, {
    success: false,
    message: "No fue posible cerrar la sesión.",
  });
});
