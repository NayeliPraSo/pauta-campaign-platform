
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  generateSessionToken,
  hashSessionToken,
} from "./sessionToken.js";

test("Genera un token de sesión de 64 caracteres hexadecimales", () => {
  const token = generateSessionToken();

  assert.equal(token.length, 64);
  assert.match(token, /^[a-f0-9]{64}$/);
});

test("Genera tokens diferentes en cada llamada", () => {
  const firstToken = generateSessionToken();
  const secondToken = generateSessionToken();

  assert.notEqual(firstToken, secondToken);
});

test("Genera un hash SHA-256 de 64 caracteres hexadecimales", () => {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  assert.equal(tokenHash.length, 64);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
});

test("Genera el mismo hash para el mismo token", () => {
  const token = generateSessionToken();

  const firstHash = hashSessionToken(token);
  const secondHash = hashSessionToken(token);

  assert.equal(firstHash, secondHash);
});

test("Genera hashes diferentes para tokens diferentes", () => {
  const firstToken = generateSessionToken();
  const secondToken = generateSessionToken();

  assert.notEqual(
    hashSessionToken(firstToken),
    hashSessionToken(secondToken),
  );
});

test("El hash no contiene el token original", () => {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  assert.notEqual(tokenHash, token);
});
