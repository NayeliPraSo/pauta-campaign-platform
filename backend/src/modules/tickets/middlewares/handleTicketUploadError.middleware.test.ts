
import assert from "node:assert/strict";
import { test } from "node:test";

import multer from "multer";

import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  handleTicketUploadError,
} from "./handleTicketUploadError.middleware.js";

function executeMiddleware(error: Error) {
  let statusCode = 200;
  let responseBody: unknown;
  let forwardedError: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as Response;

  const next = ((receivedError?: unknown) => {
    forwardedError = receivedError;
  }) as NextFunction;

  handleTicketUploadError(
    error,
    {} as Request,
    response,
    next,
  );

  return {
    statusCode,
    responseBody,
    forwardedError,
  };
}

test("Rechaza archivos que superan los 10 MB", () => {
  const result = executeMiddleware(
    new multer.MulterError("LIMIT_FILE_SIZE"),
  );

  assert.equal(result.statusCode, 413);

  assert.deepEqual(result.responseBody, {
    success: false,
    message: "El archivo no puede superar los 10 MB.",
  });

  assert.equal(result.forwardedError, undefined);
});

test("Rechaza otros errores de Multer con HTTP 400", () => {
  const result = executeMiddleware(
    new multer.MulterError("LIMIT_UNEXPECTED_FILE"),
  );

  assert.equal(result.statusCode, 400);

  assert.deepEqual(result.responseBody, {
    success: false,
    message: "No fue posible cargar el archivo.",
  });

  assert.equal(result.forwardedError, undefined);
});

test("Rechaza formatos no permitidos con HTTP 400", () => {
  const result = executeMiddleware(
    new Error(
      "Formato no permitido. Solo se aceptan archivos PDF, JPG y PNG.",
    ),
  );

  assert.equal(result.statusCode, 400);

  assert.deepEqual(result.responseBody, {
    success: false,
    message:
      "Formato no permitido. Solo se aceptan archivos PDF, JPG y PNG.",
  });

  assert.equal(result.forwardedError, undefined);
});

test("Propaga errores inesperados a Express", () => {
  const error = new Error("Error inesperado");

  const result = executeMiddleware(error);

  assert.equal(result.forwardedError, error);
  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody, undefined);
});
