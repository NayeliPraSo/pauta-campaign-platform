
import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";

import { createRequireAuthMiddleware } from "../auth/middlewares/requireAuth.middleware.js";
import { SESSION_COOKIE_NAME } from "../auth/sessionCookie.js";
import type { ParticipantSession } from "../auth/sessions.repository.js";

import {
  createTicketsRouter,
  type TicketsRouterDependencies,
} from "./tickets.routes.js";

import { DuplicateTicketError } from "./tickets.service.js";

const TEST_SESSION_TOKEN = "a".repeat(64);

const mockSession: ParticipantSession = {
  id: "10",
  participant_id: "15",
  token_hash: "b".repeat(64),
  created_at: new Date("2026-11-18T10:00:00.000Z"),
  expires_at: new Date("2026-11-18T22:00:00.000Z"),
  revoked_at: null,
};

const createdAt = new Date(
  "2026-11-18T10:00:00.000Z",
);

// PNG mínimo de prueba.
// El middleware actual verifica la firma PNG
// y que coincida con el MIME declarado.
const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
  "base64",
);

function createMockAuth(
  validSession = true,
) {
  return createRequireAuthMiddleware({
    validateSession: async () =>
      validSession ? mockSession : null,
  });
}

async function sendTicketRequest(
  dependencies: TicketsRouterDependencies,
  options: {
    origin?: string;
    includeCookie?: boolean;
    includeFile?: boolean;
  } = {},
) {
  const app = express();

  app.use(
    "/api/tickets",
    createTicketsRouter(dependencies),
  );

  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;

    const form = new FormData();

    if (options.includeFile !== false) {
      form.append(
        "file",
        new Blob([new Uint8Array(testPng)], {
          type: "image/png",
        }),
        "ticket.png",
      );
    }

    const headers: Record<string, string> = {
      Origin:
        options.origin ?? "http://localhost:4321",
    };

    if (options.includeCookie !== false) {
      headers.Cookie =
        `${SESSION_COOKIE_NAME}=${TEST_SESSION_TOKEN}`;
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/tickets`,
      {
        method: "POST",
        headers,
        body: form,
      },
    );

    const body: unknown = await response.json();

    return {
      status: response.status,
      body,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test("POST /api/tickets devuelve 201 con OCR procesado", async () => {
  let receivedParticipantId: string | undefined;

  const result = await sendTicketRequest({
    authenticate: createMockAuth(),

    register: async (input) => {
      receivedParticipantId = input.participantId;

      return {
        id: "100",
        participantId: "15",
        status: "pending",
        createdAt,
        ocrStatus: "processed",
      };
    },
  });

  assert.equal(result.status, 201);
  assert.equal(receivedParticipantId, "15");

  assert.deepEqual(result.body, {
    success: true,
    message:
      "El comprobante se registró y procesó correctamente. Su validación está pendiente.",
    data: {
      id: "100",
      status: "pending",
      ocrStatus: "processed",
      createdAt: createdAt.toISOString(),
    },
  });
});

test("POST /api/tickets devuelve 201 con OCR pendiente", async () => {
  const result = await sendTicketRequest({
    authenticate: createMockAuth(),

    register: async () => ({
      id: "100",
      participantId: "15",
      status: "pending",
      createdAt,
      ocrStatus: "pending",
    }),
  });

  assert.equal(result.status, 201);

  assert.deepEqual(result.body, {
    success: true,
    message:
      "El comprobante se registró correctamente, pero su procesamiento está pendiente. No es necesario volver a subirlo.",
    data: {
      id: "100",
      status: "pending",
      ocrStatus: "pending",
      createdAt: createdAt.toISOString(),
    },
  });
});

test("POST /api/tickets devuelve 409 ante un duplicado", async () => {
  const result = await sendTicketRequest({
    authenticate: createMockAuth(),

    register: async () => {
      throw new DuplicateTicketError();
    },
  });

  assert.equal(result.status, 409);

  assert.deepEqual(result.body, {
    success: false,
    message:
      "Este comprobante ya fue registrado anteriormente.",
  });
});

test("POST /api/tickets rechaza un origen no permitido", async () => {
  let registerCalled = false;

  const result = await sendTicketRequest(
    {
      authenticate: createMockAuth(),

      register: async () => {
        registerCalled = true;

        throw new Error(
          "No debe registrarse el comprobante",
        );
      },
    },
    {
      origin: "http://sitio-no-permitido.example",
    },
  );

  assert.equal(result.status, 403);
  assert.equal(registerCalled, false);

  assert.deepEqual(result.body, {
    success: false,
    message:
      "El origen de la solicitud no está permitido.",
  });
});

test("POST /api/tickets rechaza una sesión inexistente", async () => {
  let registerCalled = false;

  const result = await sendTicketRequest({
    authenticate: createMockAuth(false),

    register: async () => {
      registerCalled = true;

      throw new Error(
        "No debe registrarse el comprobante",
      );
    },
  });

  assert.equal(result.status, 401);
  assert.equal(registerCalled, false);

  assert.deepEqual(result.body, {
    success: false,
    message:
      "Tu sesión no es válida o ha expirado.",
  });
});
const registrationScenarios = [
  {
    status: "approved",
    message:
      "Tu comprobante fue registrado y aprobado correctamente.",
  },
  {
    status: "rejected",
    message:
      "Tu comprobante fue registrado, pero no cumple con las reglas de participación.",
  },
  {
    status: "requires_review",
    message:
      "Tu comprobante fue registrado y será revisado.",
  },
  {
    status: "processing",
    message:
      "Tu comprobante se encuentra en procesamiento.",
  },
] as const;

for (const scenario of registrationScenarios) {
  test(
    `POST /api/tickets devuelve 201 con estado ${scenario.status}`,
    async () => {
      const result = await sendTicketRequest({
        authenticate: createMockAuth(),

        register: async () => ({
          id: "100",
          participantId: "15",
          status: scenario.status,
          createdAt,
          ocrStatus: "processed",
        }),
      });

      assert.equal(result.status, 201);

      assert.deepEqual(result.body, {
        success: true,
        message: scenario.message,
        data: {
          id: "100",
          status: scenario.status,
          ocrStatus: "processed",
          createdAt: createdAt.toISOString(),
        },
      });
    },
  );
}