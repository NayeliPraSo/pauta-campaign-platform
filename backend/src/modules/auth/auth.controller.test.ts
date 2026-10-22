
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response } from "express";

import { registerParticipantController } from "./auth.controller.js";

import {
  AuthValidationError,
  ParticipantAlreadyExistsError,
} from "./auth.service.js";

interface MockResponse {
  statusCode: number;
  body: unknown;
  response: Response;
}

function createMockResponse(): MockResponse {
  const mock: MockResponse = {
    statusCode: 200,
    body: undefined,
    response: {} as Response,
  };

  mock.response.status = ((code: number) => {
    mock.statusCode = code;
    return mock.response;
  }) as Response["status"];

  mock.response.json = ((body: unknown) => {
    mock.body = body;
    return mock.response;
  }) as Response["json"];

  return mock;
}

function createValidRequest(): Request {
  return {
    body: {
      full_name: "Participante de prueba",
      email: "prueba@example.com",
      password: "ClaveSegura123!",
      accepted_terms: true,
      accepted_privacy: true,
    },
  } as Request;
}

test("Rechaza un body nulo", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    { body: null } as Request,
    mock.response,
  );

  assert.equal(mock.statusCode, 400);

  assert.deepEqual(mock.body, {
    success: false,
    message: "Los datos del registro no son válidos.",
  });
});

test("Rechaza un arreglo como body", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    { body: [] } as unknown as Request,
    mock.response,
  );

  assert.equal(mock.statusCode, 400);
});

test("Rechaza un texto como body", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    { body: "datos incorrectos" } as Request,
    mock.response,
  );

  assert.equal(mock.statusCode, 400);
});

test("Rechaza un body indefinido", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    { body: undefined } as Request,
    mock.response,
  );

  assert.equal(mock.statusCode, 400);
});

test("Devuelve 201 cuando el registro es exitoso", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    createValidRequest(),
    mock.response,
    {
      register: async () => ({
        id: "123",
        full_name: "Participante de prueba",
        email: "prueba@example.com",
      }),
    },
  );

  assert.equal(mock.statusCode, 201);

  assert.deepEqual(mock.body, {
    success: true,
    message: "Participante registrado correctamente.",
    data: {
      participant: {
        id: "123",
        full_name: "Participante de prueba",
        email: "prueba@example.com",
      },
    },
  });
});

test("Devuelve 400 cuando el servicio rechaza los datos", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    createValidRequest(),
    mock.response,
    {
      register: async () => {
        throw new AuthValidationError(
          "Debes aceptar los términos y el aviso de privacidad.",
        );
      },
    },
  );

  assert.equal(mock.statusCode, 400);

  assert.deepEqual(mock.body, {
    success: false,
    message:
      "Debes aceptar los términos y el aviso de privacidad.",
  });
});

test("Devuelve 409 cuando el correo ya existe", async () => {
  const mock = createMockResponse();

  await registerParticipantController(
    createValidRequest(),
    mock.response,
    {
      register: async () => {
        throw new ParticipantAlreadyExistsError();
      },
    },
  );

  assert.equal(mock.statusCode, 409);

  assert.deepEqual(mock.body, {
    success: false,
    message:
      "Ya existe una cuenta registrada con ese correo electrónico.",
  });
});

test("Devuelve 500 cuando ocurre un error interno", async () => {
  const mock = createMockResponse();

  const originalConsoleError = console.error;

  // Evitamos imprimir el error simulado durante esta prueba.
  console.error = () => {};

  try {
    await registerParticipantController(
      createValidRequest(),
      mock.response,
      {
        register: async () => {
          throw new Error("Error interno simulado");
        },
      },
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(mock.statusCode, 500);

  assert.deepEqual(mock.body, {
    success: false,
    message: "No fue posible completar el registro.",
  });
});
