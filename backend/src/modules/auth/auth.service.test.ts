
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthValidationError,
  registerParticipant,
  type RegisterParticipantInput,
} from "./auth.service.js";

const validInput: RegisterParticipantInput = {
  full_name: "Participante de prueba",
  email: "prueba@example.com",
  password: "ClaveSegura123!",
  accepted_terms: true,
  accepted_privacy: true,
};

test("Rechaza un nombre vacío", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      full_name: "   ",
    }),
    AuthValidationError,
  );
});

test("Rechaza un nombre de más de 150 caracteres", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      full_name: "A".repeat(151),
    }),
    AuthValidationError,
  );
});

test("Rechaza un correo electrónico inválido", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      email: "correo-invalido",
    }),
    AuthValidationError,
  );
});

test("Rechaza una contraseña demasiado corta", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      password: "123456",
    }),
    AuthValidationError,
  );
});

test("Rechaza una contraseña vacía", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      password: "",
    }),
    AuthValidationError,
  );
});

test("Rechaza una contraseña que supera 1024 bytes", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      password: "A".repeat(1025),
    }),
    AuthValidationError,
  );
});

test("Rechaza el registro sin aceptar los términos", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      accepted_terms: false,
    }),
    AuthValidationError,
  );
});

test("Rechaza el registro sin aceptar el aviso de privacidad", async () => {
  await assert.rejects(
    registerParticipant({
      ...validInput,
      accepted_privacy: false,
    }),
    AuthValidationError,
  );
});
