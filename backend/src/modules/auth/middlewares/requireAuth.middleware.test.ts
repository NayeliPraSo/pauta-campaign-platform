
import assert from "node:assert/strict";
import test from "node:test";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createRequireAuthMiddleware,
} from "./requireAuth.middleware.js";

import type {
  ParticipantSession,
} from "../sessions.repository.js";

const VALID_TOKEN = "a".repeat(64);

const VALID_SESSION: ParticipantSession = {
  id: "25",
  participant_id: "17",
  token_hash: "b".repeat(64),
  created_at: new Date("2026-10-26T08:00:00.000Z"),
  expires_at: new Date("2026-10-26T20:00:00.000Z"),
  revoked_at: null,
};

function createMockResponse() {
  const state = {
    statusCode: 200,
    body: null as unknown,
  };

  const res = {
    locals: {} as Record<string, unknown>,

    status(code: number) {
      state.statusCode = code;
      return this;
    },

    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;

  return { res, state };
}

test("Rechaza solicitudes sin cookie de sesión", async () => {
  const req = {
    headers: {},
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;
  let validationCalled = false;

  const middleware = createRequireAuthMiddleware({
    validateSession: async () => {
      validationCalled = true;
      return VALID_SESSION;
    },
  });

  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(state.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(validationCalled, false);
});

test("Rechaza solicitudes con token inválido", async () => {
  const req = {
    headers: {
      cookie: "pauta_session=invalid",
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;

  const middleware = createRequireAuthMiddleware({
    validateSession: async () => VALID_SESSION,
  });

  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(state.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("Rechaza solicitudes con cookies de sesión duplicadas", async () => {
  const req = {
    headers: {
      cookie: `pauta_session=${VALID_TOKEN}; pauta_session=${VALID_TOKEN}`,
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;

  const middleware = createRequireAuthMiddleware({
    validateSession: async () => VALID_SESSION,
  });

  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(state.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("Rechaza sesiones que no existen o han expirado", async () => {
  const req = {
    headers: {
      cookie: `pauta_session=${VALID_TOKEN}`,
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;

  const middleware = createRequireAuthMiddleware({
    validateSession: async () => null,
  });

  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(state.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("Permite continuar cuando la sesión es válida", async () => {
  const req = {
    headers: {
      cookie: `pauta_session=${VALID_TOKEN}`,
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;
  let receivedToken: string | undefined;

  const middleware = createRequireAuthMiddleware({
    validateSession: async (token) => {
      receivedToken = token;
      return VALID_SESSION;
    },
  });

  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(receivedToken, VALID_TOKEN);
  assert.equal(nextCalled, true);
  assert.equal(state.statusCode, 200);

  assert.deepEqual(res.locals.auth, {
    participantId: "17",
    sessionId: "25",
  });
});

test("Responde 500 cuando ocurre un error al validar la sesión", async () => {
  const req = {
    headers: {
      cookie: `pauta_session=${VALID_TOKEN}`,
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const middleware = createRequireAuthMiddleware({
      validateSession: async () => {
        throw new Error("Error de PostgreSQL");
      },
    });

    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(state.statusCode, 500);
    assert.equal(nextCalled, false);

    assert.deepEqual(state.body, {
      success: false,
      message: "No fue posible verificar la sesión.",
    });
  } finally {
    console.error = originalConsoleError;
  }
});


test("Rechaza el acceso cuando la sesión fue revocada", async () => {
  const req = {
    headers: {
      cookie: `pauta_session=${VALID_TOKEN}`,
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;
  let validationCalled = false;

  const middleware = createRequireAuthMiddleware({
    validateSession: async () => {
      validationCalled = true;

      // El repositorio no devuelve sesiones revocadas.
      return null;
    },
  });

  await middleware(
    req,
    res,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  assert.equal(validationCalled, true);
  assert.equal(state.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(res.locals.auth, undefined);
});

test("Rechaza el acceso cuando la cuenta está desactivada", async () => {
  const req = {
    headers: {
      cookie: `pauta_session=${VALID_TOKEN}`,
    },
  } as Request;

  const { res, state } = createMockResponse();

  let nextCalled = false;

  const middleware = createRequireAuthMiddleware({
    validateSession: async () => {
      // El repositorio filtra participantes inactivos.
      return null;
    },
  });

  await middleware(
    req,
    res,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  assert.equal(state.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(res.locals.auth, undefined);

  assert.deepEqual(state.body, {
    success: false,
    message: "Tu sesión no es válida o ha expirado.",
  });
});
