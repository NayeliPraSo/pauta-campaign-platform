
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateTicket } from "./engine";
import type { ValidationRule } from "./types";

const minimumAmountRule: ValidationRule = {
  id: "1",
  rule_type: "minimum_amount",
  configuration: {
    minimum: 150,
    currency: "MXN",
  },
  failure_action: "rejected",
  is_enabled: true,
};

const purchaseDateRule: ValidationRule = {
  id: "2",
  rule_type: "purchase_date_range",
  configuration: {
    start_date: "2026-11-01",
    end_date: "2026-11-30",
  },
  failure_action: "rejected",
  is_enabled: true,
};

const rules: ValidationRule[] = [
  minimumAmountRule,
  purchaseDateRule,
];

test("Aprueba cuando todas las reglas se cumplen", () => {
  const result = validateTicket(
    {
      total_amount: 200,
      currency: "MXN",
      purchase_date: "2026-11-15",
    },
    rules,
  );

  assert.equal(result.status, "approved");
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every((item) => item.passed === true));
});

test("Rechaza cuando el importe es insuficiente", () => {
  const result = validateTicket(
    {
      total_amount: 100,
      currency: "MXN",
      purchase_date: "2026-11-15",
    },
    rules,
  );

  assert.equal(result.status, "rejected");
});

test("Rechaza cuando la compra está fuera del periodo", () => {
  const result = validateTicket(
    {
      total_amount: 200,
      currency: "MXN",
      purchase_date: "2026-10-31",
    },
    rules,
  );

  assert.equal(result.status, "rejected");
});

test("Solicita revisión cuando falta la fecha", () => {
  const result = validateTicket(
    {
      total_amount: 200,
      currency: "MXN",
    },
    rules,
  );

  assert.equal(result.status, "requires_review");
});

test("El rechazo tiene prioridad sobre la revisión", () => {
  const result = validateTicket(
    {
      total_amount: 100,
      currency: "MXN",
    },
    rules,
  );

  assert.equal(result.status, "rejected");
  assert.equal(result.results.length, 2);
});

test("Respeta failure_action requires_review", () => {
  const reviewRule: ValidationRule = {
    ...minimumAmountRule,
    failure_action: "requires_review",
  };

  const result = validateTicket(
    {
      total_amount: 100,
      currency: "MXN",
    },
    [reviewRule],
  );

  assert.equal(result.status, "requires_review");
});

test("Omite las reglas desactivadas", () => {
  const disabledRule: ValidationRule = {
    ...minimumAmountRule,
    is_enabled: false,
  };

  const result = validateTicket(
    {
      total_amount: 100,
      currency: "MXN",
      purchase_date: "2026-11-15",
    },
    [disabledRule, purchaseDateRule],
  );

  assert.equal(result.status, "approved");
  assert.equal(result.results.length, 1);
});

test("Envía a revisión una regla no implementada", () => {
  const unimplementedRule: ValidationRule = {
    id: "3",
    rule_type: "allowed_merchants",
    configuration: {
      merchants: ["Tienda Ejemplo"],
    },
    failure_action: "requires_review",
    is_enabled: true,
  };

  const result = validateTicket(
    {
      merchant_name: "Tienda Ejemplo",
    },
    [unimplementedRule],
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.results[0].passed, null);
});


test("No aprueba tickets cuando no existen reglas", () => {
  const result = validateTicket(
    {
      total_amount: 200,
      currency: "MXN",
      purchase_date: "2026-11-15",
    },
    [],
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.results.length, 0);
});

test("No aprueba tickets cuando todas las reglas están desactivadas", () => {
  const disabledRules: ValidationRule[] = rules.map((rule) => ({
    ...rule,
    is_enabled: false,
  }));

  const result = validateTicket(
    {
      total_amount: 200,
      currency: "MXN",
      purchase_date: "2026-11-15",
    },
    disabledRules,
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.results.length, 0);
});


test("No aprueba cuando failure_action es inválido", () => {
  const invalidRule = {
    ...minimumAmountRule,
    failure_action: "unknown",
  } as unknown as ValidationRule;

  const result = validateTicket(
    {
      total_amount: 200,
      currency: "MXN",
    },
    [invalidRule],
  );

  assert.equal(result.status, "requires_review");
});

