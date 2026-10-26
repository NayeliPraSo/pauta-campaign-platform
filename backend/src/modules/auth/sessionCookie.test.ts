
import assert from "node:assert/strict";
import { test } from "node:test";

import type { CookieOptions, Response } from "express";

import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  setSessionCookie,
  clearSessionCookie,
  readSessionTokenFromCookie,
} from "./sessionCookie.js";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

test("Utiliza el nombre correcto para la cookie", () => {
  assert.equal(SESSION_COOKIE_NAME, "pauta_session");
});

test("Configura las opciones de seguridad de la cookie", () => {
  const options = getSessionCookieOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, SESSION_DURATION_MS);
});

test("Activa Secure únicamente en producción", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";

    assert.equal(getSessionCookieOptions().secure, true);

    process.env.NODE_ENV = "development";

    assert.equal(getSessionCookieOptions().secure, false);
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("Establece la cookie con el token y las opciones correctas", () => {
  const token = "a".repeat(64);

  let capturedName: string | undefined;
  let capturedValue: string | undefined;
  let capturedOptions: CookieOptions | undefined;

  const mockResponse = {
    cookie: (
      name: string,
      value: string,
      options: CookieOptions,
    ) => {
      capturedName = name;
      capturedValue = value;
      capturedOptions = options;
    },
  } as unknown as Response;

  setSessionCookie(mockResponse, token);

  assert.equal(capturedName, SESSION_COOKIE_NAME);
  assert.equal(capturedValue, token);
  assert.deepEqual(capturedOptions, getSessionCookieOptions());
});

test("Elimina la cookie sin incluir maxAge", () => {
  let capturedName: string | undefined;
  let capturedOptions: CookieOptions | undefined;

  const mockResponse = {
    clearCookie: (
      name: string,
      options: CookieOptions,
    ) => {
      capturedName = name;
      capturedOptions = options;
    },
  } as unknown as Response;

  clearSessionCookie(mockResponse);

  assert.equal(capturedName, SESSION_COOKIE_NAME);
  assert.ok(capturedOptions);
  assert.equal(capturedOptions.maxAge, undefined);
  assert.equal(capturedOptions.httpOnly, true);
  assert.equal(capturedOptions.sameSite, "lax");
  assert.equal(capturedOptions.path, "/");
  assert.equal(
    capturedOptions.secure,
    process.env.NODE_ENV === "production",
  );
});


test("Lee correctamente el token de la cookie de sesión", () => {
  const token = "a".repeat(64);

  const cookieHeader = `theme=dark; pauta_session=${token}; language=es`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, token);
});

test("Devuelve null cuando no existe el encabezado Cookie", () => {
  const result = readSessionTokenFromCookie(undefined);

  assert.equal(result, null);
});

test("Devuelve null cuando no existe la cookie de sesión", () => {
  const cookieHeader = "theme=dark; language=es";

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, null);
});

test("Rechaza cookies de sesión con tokens inválidos", () => {
  const invalidTokens = [
    "",
    "abc",
    "a".repeat(63),
    "a".repeat(65),
    "g".repeat(64),
    "A".repeat(64),
    " ".repeat(64),
  ];

  for (const token of invalidTokens) {
    const cookieHeader = `pauta_session=${token}`;

    const result = readSessionTokenFromCookie(cookieHeader);

    assert.equal(result, null);
  }
});

test("Ignora cookies que no tienen un separador válido", () => {
  const token = "a".repeat(64);

  const cookieHeader = `invalidCookie; theme=dark; pauta_session=${token}`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, token);
});


test("Rechaza dos cookies de sesión con tokens diferentes", () => {
  const firstToken = "a".repeat(64);
  const secondToken = "b".repeat(64);

  const cookieHeader =
    `pauta_session=${firstToken}; pauta_session=${secondToken}`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, null);
});

test("Rechaza dos cookies de sesión con el mismo token", () => {
  const token = "a".repeat(64);

  const cookieHeader =
    `pauta_session=${token}; pauta_session=${token}`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, null);
});

test("Rechaza cookies duplicadas aunque estén separadas por otras cookies", () => {
  const firstToken = "a".repeat(64);
  const secondToken = "b".repeat(64);

  const cookieHeader =
    `pauta_session=${firstToken}; theme=dark; language=es; pauta_session=${secondToken}`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, null);
});

test("Rechaza cookies duplicadas aunque una tenga un token inválido", () => {
  const validToken = "a".repeat(64);

  const cookieHeader =
    `pauta_session=${validToken}; pauta_session=invalid`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, null);
});

test("Acepta una sola cookie de sesión acompañada de otras cookies", () => {
  const token = "a".repeat(64);

  const cookieHeader =
    `theme=dark; pauta_session=${token}; language=es`;

  const result = readSessionTokenFromCookie(cookieHeader);

  assert.equal(result, token);
});
