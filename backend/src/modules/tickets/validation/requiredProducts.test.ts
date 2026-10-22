
import assert from "node:assert/strict";
import test from "node:test";

import { validateRequiredProducts } from "./requiredProducts";
import type { ValidationRule } from "./types";

const rule: ValidationRule = {
  id: "4",
  rule_type: "required_products",
  configuration: {
    products: [
      {
        name: "Coca-Cola 600 ml",
        aliases: ["Coca Cola 600ML", "Coca-Cola PET 600"],
      },
      {
        name: "Sprite 600 ml",
        aliases: ["Sprite PET 600"],
      },
    ],
    minimum_quantity: 1,
  },
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba un producto participante", () => {
  const result = validateRequiredProducts(rule, {
    products: [
      { description: "Coca-Cola 600 ml", quantity: 1 },
    ],
  });

  assert.equal(result.passed, true);
});

test("Acepta un alias de producto", () => {
  const result = validateRequiredProducts(rule, {
    products: [
      { description: "Coca-Cola PET 600", quantity: 1 },
    ],
  });

  assert.equal(result.passed, true);
});

test("Ignora diferencias de mayúsculas y signos", () => {
  const result = validateRequiredProducts(rule, {
    products: [
      { description: "COCA COLA 600 ML", quantity: 1 },
    ],
  });

  assert.equal(result.passed, true);
});

test("Rechaza productos no participantes", () => {
  const result = validateRequiredProducts(rule, {
    products: [
      { description: "Agua natural 600 ml", quantity: 1 },
    ],
  });

  assert.equal(result.passed, false);
});

test("Suma cantidades de distintos productos participantes", () => {
  const quantityRule: ValidationRule = {
    ...rule,
    configuration: {
      ...rule.configuration,
      minimum_quantity: 3,
    },
  };

  const result = validateRequiredProducts(quantityRule, {
    products: [
      { description: "Coca-Cola 600 ml", quantity: 2 },
      { description: "Sprite PET 600", quantity: 1 },
    ],
  });

  assert.equal(result.passed, true);
});

test("Rechaza cuando no alcanza la cantidad mínima", () => {
  const quantityRule: ValidationRule = {
    ...rule,
    configuration: {
      ...rule.configuration,
      minimum_quantity: 3,
    },
  };

  const result = validateRequiredProducts(quantityRule, {
    products: [
      { description: "Coca-Cola 600 ml", quantity: 1 },
      { description: "Sprite 600 ml", quantity: 1 },
    ],
  });

  assert.equal(result.passed, false);
});

test("Solicita revisión cuando faltan los productos", () => {
  const result = validateRequiredProducts(rule, {});

  assert.equal(result.passed, null);
});

test("Solicita revisión cuando la lista está vacía", () => {
  const result = validateRequiredProducts(rule, {
    products: [],
  });

  assert.equal(result.passed, null);
});

test("Detecta una configuración sin productos", () => {
  const result = validateRequiredProducts(
    {
      ...rule,
      configuration: {
        products: [],
        minimum_quantity: 1,
      },
    },
    {
      products: [
        { description: "Coca-Cola 600 ml", quantity: 1 },
      ],
    },
  );

  assert.equal(result.passed, null);
});

test("Detecta una cantidad mínima inválida", () => {
  const result = validateRequiredProducts(
    {
      ...rule,
      configuration: {
        ...rule.configuration,
        minimum_quantity: 0,
      },
    },
    {
      products: [
        { description: "Coca-Cola 600 ml", quantity: 1 },
      ],
    },
  );

  assert.equal(result.passed, null);
});

test("Solicita revisión cuando la cantidad OCR es inválida", () => {
  const result = validateRequiredProducts(rule, {
    products: [
      { description: "Coca-Cola 600 ml", quantity: -2 },
    ],
  });

  assert.equal(result.passed, null);
});

test("No acepta coincidencias parciales de productos", () => {
  const result = validateRequiredProducts(rule, {
    products: [
      { description: "Coca-Cola 2 litros", quantity: 1 },
    ],
  });

  assert.equal(result.passed, false);
});
