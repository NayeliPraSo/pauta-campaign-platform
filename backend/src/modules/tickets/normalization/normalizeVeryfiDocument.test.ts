
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVeryfiDocument } from "./normalizeVeryfiDocument.js";

test("Normaliza los datos principales de Veryfi", () => {
  const result = normalizeVeryfiDocument({
    id: 12345,
    vendor: {
      name: "  Comercio de prueba  ",
    },
    date: "2026-11-18",
    total: 250,
    currency_code: "mxn",
    line_items: [
      {
        description: "  Producto A  ",
        quantity: 2,
        total: 150,
      },
      {
        description: "Producto B",
        quantity: 1,
        total: 100,
      },
    ],
  });

  assert.deepEqual(result, {
    merchant_name: "Comercio de prueba",
    purchase_date: "2026-11-18",
    total_amount: 250,
    currency: "MXN",
    products: [
      {
        description: "Producto A",
        quantity: 2,
        total: 150,
      },
      {
        description: "Producto B",
        quantity: 1,
        total: 100,
      },
    ],
  });
});

test("Admite valores dentro de BoundingElement", () => {
  const result = normalizeVeryfiDocument({
    vendor: {
      name: { value: "Comercio" },
    },
    date: { value: "2026-11-18" },
    total: { value: 250 },
    currency_code: { value: "MXN" },
    line_items: [
      {
        description: { value: "Producto A" },
        quantity: { value: 2 },
        total: { value: 250 },
      },
    ],
  });

  assert.equal(result.merchant_name, "Comercio");
  assert.equal(result.purchase_date, "2026-11-18");
  assert.equal(result.total_amount, 250);
  assert.equal(result.currency, "MXN");

  assert.deepEqual(result.products, [
    {
      description: "Producto A",
      quantity: 2,
      total: 250,
    },
  ]);
});

test("Omite productos sin descripción válida", () => {
  const result = normalizeVeryfiDocument({
    line_items: [
      { description: null, total: 100 },
      { description: "   ", total: 50 },
      { description: { value: null }, total: 75 },
      { description: "Producto válido", total: 25 },
    ],
  });

  assert.deepEqual(result.products, [
    {
      description: "Producto válido",
      total: 25,
    },
  ]);
});

test("Conserva productos sin cantidad o importe", () => {
  const result = normalizeVeryfiDocument({
    line_items: [
      {
        description: "Producto A",
        quantity: null,
        total: null,
      },
      {
        description: "Producto B",
        quantity: -2,
        total: -100,
      },
    ],
  });

  assert.deepEqual(result.products, [
    { description: "Producto A" },
    { description: "Producto B" },
  ]);
});

test("Devuelve valores vacíos cuando faltan datos OCR", () => {
  const result = normalizeVeryfiDocument({});

  assert.deepEqual(result, {
    merchant_name: null,
    purchase_date: null,
    total_amount: null,
    currency: null,
    products: [],
  });
});

test("Rechaza fechas inexistentes", () => {
  const result = normalizeVeryfiDocument({
    date: "2026-02-30",
  });

  assert.equal(result.purchase_date, null);
});

test("No convierte importes de texto a números", () => {
  const result = normalizeVeryfiDocument({
    total: { value: "250" },
  });

  assert.equal(result.total_amount, null);
});

test("No modifica el documento original", () => {
  const document = {
    vendor: {
      name: "  Comercio original  ",
    },
    line_items: [
      {
        description: "  Producto original  ",
      },
    ],
  };

  normalizeVeryfiDocument(document);

  assert.equal(document.vendor.name, "  Comercio original  ");
  assert.equal(
    document.line_items[0]?.description,
    "  Producto original  ",
  );
});
