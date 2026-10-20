
import assert from "node:assert/strict";
import { test } from "node:test";

import { validatePurchaseDateRange } from "./purchaseDateRange";
import type { ValidationRule } from "./types";

const rule: ValidationRule = {
  id: "2",
  rule_type: "purchase_date_range",
  configuration: {
    start_date: "2026-11-01",
    end_date: "2026-11-30",
  },
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba una fecha dentro del periodo", () => {
  const result = validatePurchaseDateRange(rule, {
    purchase_date: "2026-11-15",
  });

  assert.equal(result.passed, true);
});

test("Aprueba la fecha inicial", () => {
  const result = validatePurchaseDateRange(rule, {
    purchase_date: "2026-11-01",
  });

  assert.equal(result.passed, true);
});

test("Aprueba la fecha final", () => {
  const result = validatePurchaseDateRange(rule, {
    purchase_date: "2026-11-30",
  });

  assert.equal(result.passed, true);
});

test("Detecta una compra anterior al periodo", () => {
  const result = validatePurchaseDateRange(rule, {
    purchase_date: "2026-10-31",
  });

  assert.equal(result.passed, false);
});

test("Detecta una compra posterior al periodo", () => {
  const result = validatePurchaseDateRange(rule, {
    purchase_date: "2026-12-01",
  });

  assert.equal(result.passed, false);
});

test("Solicita revisión si falta la fecha", () => {
  const result = validatePurchaseDateRange(rule, {});

  assert.equal(result.passed, null);
});

test("Detecta una fecha inexistente", () => {
  const result = validatePurchaseDateRange(rule, {
    purchase_date: "2026-02-30",
  });

  assert.equal(result.passed, null);
});

test("Detecta una configuración con fechas invertidas", () => {
  const invalidRule: ValidationRule = {
    ...rule,
    configuration: {
      start_date: "2026-11-30",
      end_date: "2026-11-01",
    },
  };

  const result = validatePurchaseDateRange(invalidRule, {
    purchase_date: "2026-11-15",
  });

  assert.equal(result.passed, null);
});
