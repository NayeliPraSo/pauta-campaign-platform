
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

test("Envía a revisión una regla desconocida", () => {
  const unimplementedRule: ValidationRule = {
    id: "3",
    rule_type: "unknown_rule" as ValidationRule["rule_type"],
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


test("Aprueba un ticket de un comercio permitido", () => {
  const merchantRule: ValidationRule = {
    id: "3",
    rule_type: "allowed_merchants",
    configuration: {
      merchants: ["Walmart", "Soriana", "Chedraui"],
    },
    failure_action: "rejected",
    is_enabled: true,
  };

  const result = validateTicket(
    {
      merchant_name: "WALMART",
    },
    [merchantRule],
  );

  assert.equal(result.status, "approved");
  assert.equal(result.results[0]?.passed, true);
});

test("Rechaza un ticket de un comercio no permitido", () => {
  const merchantRule: ValidationRule = {
    id: "3",
    rule_type: "allowed_merchants",
    configuration: {
      merchants: ["Walmart", "Soriana", "Chedraui"],
    },
    failure_action: "rejected",
    is_enabled: true,
  };

  const result = validateTicket(
    {
      merchant_name: "Oxxo",
    },
    [merchantRule],
  );

  assert.equal(result.status, "rejected");
  assert.equal(result.results[0]?.passed, false);
});

test("Solicita revisión cuando no identifica el comercio", () => {
  const merchantRule: ValidationRule = {
    id: "3",
    rule_type: "allowed_merchants",
    configuration: {
      merchants: ["Walmart", "Soriana", "Chedraui"],
    },
    failure_action: "rejected",
    is_enabled: true,
  };

  const result = validateTicket({}, [merchantRule]);

  assert.equal(result.status, "requires_review");
  assert.equal(result.results[0]?.passed, null);
});


const requiredProductsRule: ValidationRule = {
  id: "4",
  rule_type: "required_products",
  configuration: {
    products: [
      {
        name: "Coca-Cola 600 ml",
        aliases: ["Coca-Cola PET 600"],
      },
      {
        name: "Sprite 600 ml",
        aliases: ["Sprite PET 600"],
      },
    ],
    minimum_quantity: 2,
  },
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba un ticket con suficientes productos participantes", () => {
  const result = validateTicket(
    {
      products: [
        { description: "Coca-Cola PET 600", quantity: 1 },
        { description: "Sprite 600 ml", quantity: 1 },
      ],
    },
    [requiredProductsRule],
  );

  assert.equal(result.status, "approved");
  assert.equal(result.results[0]?.passed, true);
});

test("Rechaza un ticket con productos insuficientes", () => {
  const result = validateTicket(
    {
      products: [
        { description: "Coca-Cola 600 ml", quantity: 1 },
      ],
    },
    [requiredProductsRule],
  );

  assert.equal(result.status, "rejected");
  assert.equal(result.results[0]?.passed, false);
});

test("Solicita revisión cuando no se identifican productos", () => {
  const result = validateTicket(
    {},
    [requiredProductsRule],
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.results[0]?.passed, null);
});


const duplicateRule: ValidationRule = {
  id: "5",
  rule_type: "duplicate_ticket",
  configuration: {},
  failure_action: "rejected",
  is_enabled: true,
};

const validFileHash = "a".repeat(64);

test("Aprueba un ticket sin duplicados", () => {
  const result = validateTicket(
    {
      file_hash: validFileHash,
      duplicate_ticket_id: null,
    },
    [duplicateRule],
  );

  assert.equal(result.status, "approved");
  assert.equal(result.results[0]?.passed, true);
});

test("Rechaza un ticket duplicado", () => {
  const result = validateTicket(
    {
      file_hash: validFileHash,
      duplicate_ticket_id: "15",
    },
    [duplicateRule],
  );

  assert.equal(result.status, "rejected");
  assert.equal(result.results[0]?.passed, false);
});

test("No aprueba si falta comprobar duplicados", () => {
  const result = validateTicket(
    {
      file_hash: validFileHash,
    },
    [duplicateRule],
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.results[0]?.passed, null);
});
