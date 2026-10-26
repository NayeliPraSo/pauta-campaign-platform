
import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  requireTrustedOrigin,
} from "./requireTrustedOrigin.middleware.js";

interface MockResponse {
  statusCode: number;
  body: unknown;
}

function createMockRequest(
  headers: Record<string, string> = {},
): Request {
  return {
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

function createMockResponse(): Response & MockResponse {
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

  return res as unknown as Response & MockResponse;
}

function executeMiddleware(
  headers: Record<string, string> = {},
) {
  const req = createMockRequest(headers);
  const res = createMockResponse();

  let nextCalled = false;

  const next = (() => {
    nextCalled = true;
  }) as NextFunction;

  requireTrustedOrigin(req, res, next);

  return {
    res,
    nextCalled,
  };
}

test("Permite solicitudes desde el frontend Astro", () => {
  const result = executeMiddleware({
    origin: "http://localhost:4321",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.res.statusCode, 200);
});

test("Permite solicitudes desde el backend local", () => {
  const result = executeMiddleware({
    origin: "http://localhost:3000",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.res.statusCode, 200);
});

test("Rechaza solicitudes desde un origen desconocido", () => {
  const result = executeMiddleware({
    origin: "https://sitio-desconocido.com",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);

  assert.deepEqual(result.res.body, {
    success: false,
    message: "El origen de la solicitud no está permitido.",
  });
});

test("Permite un Referer confiable cuando no existe Origin", () => {
  const result = executeMiddleware({
    referer: "http://localhost:4321/login",
  });

  assert.equal(result.nextCalled, true);
});

test("Rechaza un Referer desconocido", () => {
  const result = executeMiddleware({
    referer: "https://sitio-desconocido.com/login",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test("Rechaza solicitudes sin Origin ni Referer", () => {
  const result = executeMiddleware();

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test("Rechaza un Origin null", () => {
  const result = executeMiddleware({
    origin: "null",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test("Da prioridad a Origin sobre Referer", () => {
  const result = executeMiddleware({
    origin: "https://sitio-desconocido.com",
    referer: "http://localhost:4321/login",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test("Rechaza un Referer malformado", () => {
  const result = executeMiddleware({
    referer: "esto-no-es-una-url",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test("Rechaza orígenes con puertos diferentes", () => {
  const result = executeMiddleware({
    origin: "http://localhost:4322",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});
