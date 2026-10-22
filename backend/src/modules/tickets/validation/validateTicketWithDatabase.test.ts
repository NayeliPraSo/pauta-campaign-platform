
import assert from "node:assert/strict";
import test from "node:test";

import { validateTicketWithDatabase } from "./validateTicketWithDatabase";
import type { ValidationRule } from "./types";

const validHash = "a".repeat(64);

const duplicateRule: ValidationRule = {
  id: "5",
  rule_type: "duplicate_ticket",
  configuration: {},
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba cuando PostgreSQL no encuentra duplicados", async () => {
  const result = await validateTicketWithDatabase(
    { file_hash: validHash },
    [duplicateRule],
    async () => null,
  );

  assert.equal(result.status, "approved");
});

test("Rechaza un ticket duplicado previamente rechazado", async () => {
  const result = await validateTicketWithDatabase(
    { file_hash: validHash },
    [duplicateRule],
    async () => ({
      id: "15",
      status: "rejected",
    }),
  );

  assert.equal(result.status, "rejected");
  assert.equal(result.results[0]?.passed, false);
});

test("Rechaza un ticket duplicado aprobado", async () => {
  const result = await validateTicketWithDatabase(
    { file_hash: validHash },
    [duplicateRule],
    async () => ({
      id: "20",
      status: "approved",
    }),
  );

  assert.equal(result.status, "rejected");
});

test("No confía en un ID de duplicado proporcionado externamente", async () => {
  const result = await validateTicketWithDatabase(
    {
      file_hash: validHash,
      duplicate_ticket_id: null,
    },
    [duplicateRule],
    async () => ({
      id: "25",
      status: "rejected",
    }),
  );

  assert.equal(result.status, "rejected");
});

test("No consulta PostgreSQL cuando el hash es inválido", async () => {
  let lookupCalled = false;

  const result = await validateTicketWithDatabase(
    { file_hash: "invalido" },
    [duplicateRule],
    async () => {
      lookupCalled = true;
      return null;
    },
  );

  assert.equal(lookupCalled, false);
  assert.equal(result.status, "requires_review");
});

test("Propaga los errores de PostgreSQL", async () => {
  await assert.rejects(
    validateTicketWithDatabase(
      { file_hash: validHash },
      [duplicateRule],
      async () => {
        throw new Error("PostgreSQL no disponible");
      },
    ),
    /PostgreSQL no disponible/,
  );
});

test("Omite la consulta cuando la regla está desactivada", async () => {
  let lookupCalled = false;

  const result = await validateTicketWithDatabase(
    { file_hash: validHash },
    [{ ...duplicateRule, is_enabled: false }],
    async () => {
      lookupCalled = true;
      return null;
    },
  );

  assert.equal(lookupCalled, false);
  assert.equal(result.status, "requires_review");
});
