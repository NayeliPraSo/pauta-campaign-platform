
import assert from "node:assert/strict";
import test from "node:test";

import { validateDuplicateTicket } from "./duplicateTicket";
import type { ValidationRule } from "./types";

const validHash = "a".repeat(64);

const rule: ValidationRule = {
  id: "5",
  rule_type: "duplicate_ticket",
  configuration: {},
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba cuando no existen duplicados", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: validHash,
    duplicate_ticket_id: null,
  });

  assert.equal(result.passed, true);
});

test("Detecta un ticket duplicado", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: validHash,
    duplicate_ticket_id: "15",
  });

  assert.equal(result.passed, false);
  assert.match(result.reason ?? "", /15/);
});

test("Detecta duplicados sin depender del estado anterior", () => {
  // El repositorio ya encontró un ticket rechazado.
  // La regla solo necesita su identificador.
  const result = validateDuplicateTicket(rule, {
    file_hash: validHash,
    duplicate_ticket_id: "20",
  });

  assert.equal(result.passed, false);
});

test("Solicita revisión cuando falta el hash", () => {
  const result = validateDuplicateTicket(rule, {
    duplicate_ticket_id: null,
  });

  assert.equal(result.passed, null);
});

test("Solicita revisión cuando el hash es inválido", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: "hash-invalido",
    duplicate_ticket_id: null,
  });

  assert.equal(result.passed, null);
});

test("No aprueba si todavía no se consultaron duplicados", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: validHash,
  });

  assert.equal(result.passed, null);
});

test("No acepta un identificador de duplicado inválido", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: validHash,
    duplicate_ticket_id: "abc",
  });

  assert.equal(result.passed, null);
});

test("No acepta un identificador igual a cero", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: validHash,
    duplicate_ticket_id: "0",
  });

  assert.equal(result.passed, null);
});

test("No valida una regla de otro tipo", () => {
  const otherRule: ValidationRule = {
    ...rule,
    rule_type: "minimum_amount",
  };

  const result = validateDuplicateTicket(otherRule, {
    file_hash: validHash,
    duplicate_ticket_id: null,
  });

  assert.equal(result.passed, null);
});

test("Rechaza cuando SHA-256 detecta duplicado y Veryfi no", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: "a".repeat(64),
    duplicate_ticket_id: "15",
    veryfi_duplicate_status: "not_duplicate",
  });

  assert.equal(result.passed, false);
  assert.match(result.reason ?? "", /ticket 15/);
});

test("Rechaza cuando Veryfi detecta duplicado y SHA-256 no", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: "a".repeat(64),
    duplicate_ticket_id: null,
    veryfi_duplicate_status: "duplicate",
  });

  assert.equal(result.passed, false);
  assert.match(result.reason ?? "", /Veryfi/);
});

test("Solicita revisión cuando Veryfi no puede confirmar duplicidad", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: "a".repeat(64),
    duplicate_ticket_id: null,
    veryfi_duplicate_status: "requires_review",
  });

  assert.equal(result.passed, null);
});

test("Aprueba la regla cuando ambos mecanismos descartan duplicados", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: "a".repeat(64),
    duplicate_ticket_id: null,
    veryfi_duplicate_status: "not_duplicate",
  });

  assert.equal(result.passed, true);
});

test("Conserva el rechazo por SHA-256 aunque Veryfi requiera revisión", () => {
  const result = validateDuplicateTicket(rule, {
    file_hash: "a".repeat(64),
    duplicate_ticket_id: "25",
    veryfi_duplicate_status: "requires_review",
  });

  assert.equal(result.passed, false);
});