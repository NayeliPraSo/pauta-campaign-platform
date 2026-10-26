
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthValidationError,
  InvalidCredentialsError,
  loginParticipant,
  validateLoginInput,
} from "./login.service.js";

test("Acepta credenciales válidas", () => {
  const result = validateLoginInput({
    email: "participante@example.com",
    password: "MiClaveSegura123!",
  });

  assert.deepEqual(result, {
    email: "participante@example.com",
    password: "MiClaveSegura123!",
  });
});

test("Normaliza el correo electrónico", () => {
  const result = validateLoginInput({
    email: "  PARTICIPANTE@EXAMPLE.COM  ",
    password: "MiClaveSegura123!",
  });

  assert.equal(result.email, "participante@example.com");
});

test("Rechaza un correo inválido", () => {
  assert.throws(
    () =>
      validateLoginInput({
        email: "correo-invalido",
        password: "MiClaveSegura123!",
      }),
    AuthValidationError,
  );
});

test("Rechaza una contraseña vacía", () => {
  assert.throws(
    () =>
      validateLoginInput({
        email: "participante@example.com",
        password: "",
      }),
    AuthValidationError,
  );
});

test("Rechaza una contraseña que supera 1024 bytes", () => {
  assert.throws(
    () =>
      validateLoginInput({
        email: "participante@example.com",
        password: "a".repeat(1025),
      }),
    AuthValidationError,
  );
});

test("No modifica la contraseña", () => {
  const password = "  MiClaveSegura123!  ";

  const result = validateLoginInput({
    email: "participante@example.com",
    password,
  });

  assert.equal(result.password, password);
});


const testParticipant = {
  id: "17",
  full_name: "Participante de prueba",
  email: "participante@example.com",
  password_hash: "hash-simulado",
  is_active: true,
};

test("Permite iniciar sesión con credenciales correctas", async () => {
  const result = await loginParticipant(
    {
      email: "PARTICIPANTE@EXAMPLE.COM",
      password: "MiClaveSegura123!",
    },
    {
      findParticipant: async (email) => {
        assert.equal(email, "participante@example.com");
        return testParticipant;
      },
      verifyParticipantPassword: async (password, storedHash) => {
        assert.equal(password, "MiClaveSegura123!");
        assert.equal(storedHash, "hash-simulado");
        return true;
      },
    },
  );

  assert.deepEqual(result, {
    id: "17",
    full_name: "Participante de prueba",
    email: "participante@example.com",
  });

  assert.equal("password_hash" in result, false);
});


test("Rechaza un correo no registrado y verifica un hash ficticio", async () => {
  let passwordVerificationCalled = false;

  await assert.rejects(
    loginParticipant(
      {
        email: "inexistente@example.com",
        password: "MiClaveSegura123!",
      },
      {
        findParticipant: async () => null,
        verifyParticipantPassword: async (password, storedHash) => {
          passwordVerificationCalled = true;

          assert.equal(password, "MiClaveSegura123!");
          assert.match(
            storedHash,
            /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/,
          );

          return false;
        },
      },
    ),
    InvalidCredentialsError,
  );

  assert.equal(passwordVerificationCalled, true);
});


test("Rechaza una contraseña incorrecta", async () => {
  await assert.rejects(
    loginParticipant(
      {
        email: "participante@example.com",
        password: "ClaveIncorrecta123!",
      },
      {
        findParticipant: async () => testParticipant,
        verifyParticipantPassword: async () => false,
      },
    ),
    InvalidCredentialsError,
  );
});

test("Rechaza una cuenta desactivada", async () => {
  const inactiveParticipant = {
    ...testParticipant,
    is_active: false,
  };

  await assert.rejects(
    loginParticipant(
      {
        email: "participante@example.com",
        password: "MiClaveSegura123!",
      },
      {
        findParticipant: async () => inactiveParticipant,
        verifyParticipantPassword: async () => true,
      },
    ),
    InvalidCredentialsError,
  );
});
