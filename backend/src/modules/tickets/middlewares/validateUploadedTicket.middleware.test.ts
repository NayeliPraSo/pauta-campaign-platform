
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response, NextFunction } from "express";

import { validateUploadedTicket } from "./validateUploadedTicket.middleware";

function createResponse() {
  let statusCode = 200;
  let body: unknown = null;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  } as Response;

  return {
    response,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

test("Permite continuar cuando el ticket es válido", () => {
  const req = {
    file: {
      buffer: Buffer.from("%PDF-1.7\nContenido de prueba"),
      mimetype: "application/pdf",
    },
  } as Request;

  const { response, getStatus } = createResponse();

  let nextCalled = false;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  validateUploadedTicket(req, response, next);

  assert.equal(nextCalled, true);
  assert.equal(getStatus(), 200);
});

test("Rechaza un archivo con contenido falsificado", () => {
  const req = {
    file: {
      buffer: Buffer.from("Contenido inválido"),
      mimetype: "image/png",
    },
  } as Request;

  const { response, getStatus, getBody } = createResponse();

  let nextCalled = false;

  validateUploadedTicket(req, response, () => {
    nextCalled = true;
  });

  assert.equal(getStatus(), 400);
  assert.equal(nextCalled, false);

  assert.deepEqual(getBody(), {
    success: false,
    message:
      "El contenido del archivo no corresponde a un PDF, JPG o PNG válido.",
  });
});

test("Rechaza una solicitud sin archivo", () => {
  const req = {} as Request;

  const { response, getStatus, getBody } = createResponse();

  let nextCalled = false;

  validateUploadedTicket(req, response, () => {
    nextCalled = true;
  });

  assert.equal(getStatus(), 400);
  assert.equal(nextCalled, false);

  assert.deepEqual(getBody(), {
    success: false,
    message: "Debes seleccionar un ticket.",
  });
});
