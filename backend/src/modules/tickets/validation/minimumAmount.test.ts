
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateMinimumAmount } from "./minimumAmount";
import type { ValidationRule, TicketData } from "./types";

const rule: ValidationRule = {
  id: "1",
  rule_type: "minimum_amount",
  configuration: {
    minimum: 150,
    currency: "MXN",
  },
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba un ticket que supera el mínimo", () => {
  const ticket: TicketData = {
    total_amount: 200,
    currency: "MXN",
  };

  const result = validateMinimumAmount(rule, ticket);

  assert.equal(result.passed, true);
});

test("Aprueba un ticket con el importe mínimo exacto", () => {
  const result = validateMinimumAmount(rule, {
    total_amount: 150,
    currency: "MXN",
  });

  assert.equal(result.passed, true);
});

test("Detecta un ticket con importe insuficiente", () => {
  const result = validateMinimumAmount(rule, {
    total_amount: 100,
    currency: "MXN",
  });

  assert.equal(result.passed, false);
});

test("Solicita revisión cuando falta el importe", () => {
  const result = validateMinimumAmount(rule, {
    currency: "MXN",
  });

  assert.equal(result.passed, null);
});

test("Solicita revisión cuando la moneda es diferente", () => {
  const result = validateMinimumAmount(rule, {
    total_amount: 200,
    currency: "USD",
  });

  assert.equal(result.passed, null);
});

test("No acepta una configuración inválida", () => {
  const invalidRule: ValidationRule = {
    ...rule,
    configuration: {
      minimum: -100,
      currency: "MXN",
    },
  };

  const result = validateMinimumAmount(invalidRule, {
    total_amount: 200,
    currency: "MXN",
  });

  assert.equal(result.passed, null);
});
