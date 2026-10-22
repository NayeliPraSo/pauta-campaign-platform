
import assert from "node:assert/strict";
import test from "node:test";

import { validateAllowedMerchants } from "./allowedMerchants";
import type { ValidationRule } from "./types";

const rule: ValidationRule = {
  id: "3",
  rule_type: "allowed_merchants",
  configuration: {
    merchants: ["Walmart", "Soriana", "Chedraui"],
  },
  failure_action: "rejected",
  is_enabled: true,
};

test("Aprueba un comercio permitido", () => {
  const result = validateAllowedMerchants(rule, {
    merchant_name: "Walmart",
  });

  assert.equal(result.passed, true);
});

test("Ignora diferencias entre mayúsculas y minúsculas", () => {
  const result = validateAllowedMerchants(rule, {
    merchant_name: "WALMART",
  });

  assert.equal(result.passed, true);
});

test("Ignora espacios y signos", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: ["Wal-Mart"],
      },
    },
    {
      merchant_name: "Wal Mart",
    },
  );

  assert.equal(result.passed, true);
});

test("Rechaza un comercio no permitido", () => {
  const result = validateAllowedMerchants(rule, {
    merchant_name: "Oxxo",
  });

  assert.equal(result.passed, false);
});

test("No acepta coincidencias parciales", () => {
  const result = validateAllowedMerchants(rule, {
    merchant_name: "Walmart Supercenter",
  });

  assert.equal(result.passed, false);
});

test("Solicita revisión cuando falta el comercio", () => {
  const result = validateAllowedMerchants(rule, {});

  assert.equal(result.passed, null);
});

test("Detecta una lista de comercios vacía", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: [],
      },
    },
    {
      merchant_name: "Walmart",
    },
  );

  assert.equal(result.passed, null);
});

test("Detecta una configuración inválida", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: "Walmart",
      },
    },
    {
      merchant_name: "Walmart",
    },
  );

  assert.equal(result.passed, null);
});


test("Acepta un alias configurado para un comercio", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: ["Walmart", "Soriana"],
        aliases: {
          Walmart: ["Wal-Mart", "Walmart Supercenter"],
        },
      },
    },
    {
      merchant_name: "Walmart Supercenter",
    },
  );

  assert.equal(result.passed, true);
});

test("Acepta un alias con diferencias de escritura", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: ["Soriana"],
        aliases: {
          Soriana: ["Soriana Híper"],
        },
      },
    },
    {
      merchant_name: "SOR IANA HIPER",
    },
  );

  assert.equal(result.passed, true);
});

test("No acepta nombres que no están configurados como alias", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: ["Walmart"],
        aliases: {
          Walmart: ["Walmart Supercenter"],
        },
      },
    },
    {
      merchant_name: "Walmart Express",
    },
  );

  assert.equal(result.passed, false);
});

test("Detecta alias asociados a comercios no permitidos", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: ["Walmart"],
        aliases: {
          Oxxo: ["Oxxo Express"],
        },
      },
    },
    {
      merchant_name: "Walmart",
    },
  );

  assert.equal(result.passed, null);
});

test("Detecta una lista de alias inválida", () => {
  const result = validateAllowedMerchants(
    {
      ...rule,
      configuration: {
        merchants: ["Walmart"],
        aliases: {
          Walmart: "Walmart Supercenter",
        },
      },
    },
    {
      merchant_name: "Walmart",
    },
  );

  assert.equal(result.passed, null);
});

test("Mantiene compatibilidad con reglas sin alias", () => {
  const result = validateAllowedMerchants(rule, {
    merchant_name: "Chedraui",
  });

  assert.equal(result.passed, true);
});
