
import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword, verifyPassword } from "./password.js";

test("Genera un hash seguro de la contraseña", async () => {
  const password = "MiClaveSegura123!";
  const hash = await hashPassword(password);

  assert.match(hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.notEqual(hash, password);
});

test("Verifica correctamente una contraseña válida", async () => {
  const password = "MiClaveSegura123!";
  const hash = await hashPassword(password);

  const result = await verifyPassword(password, hash);

  assert.equal(result, true);
});

test("Rechaza una contraseña incorrecta", async () => {
  const hash = await hashPassword("MiClaveSegura123!");

  const result = await verifyPassword("ClaveIncorrecta123!", hash);

  assert.equal(result, false);
});

test("Genera hashes diferentes para la misma contraseña", async () => {
  const password = "MiClaveSegura123!";

  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, secondHash);

  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword(password, secondHash), true);
});

test("Rechaza hashes inválidos", async () => {
  assert.equal(await verifyPassword("MiClaveSegura123!", ""), false);
  assert.equal(await verifyPassword("MiClaveSegura123!", "hash-invalido"), false);
  assert.equal(
    await verifyPassword("MiClaveSegura123!", "scrypt:salt-invalido:123"),
    false,
  );
});

test("No permite generar un hash de una contraseña vacía", async () => {
  await assert.rejects(
    hashPassword(""),
    /La contraseña es obligatoria/,
  );
});
