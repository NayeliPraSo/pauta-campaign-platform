/**
 * Pruebas unitarias de la configuración de campaña.
 *
 * Verifican la validación de los datos generales, los parámetros
 * de cada regla y su transformación al formato utilizado por
 * PostgreSQL.
 *
 * También comprueban la compatibilidad de las reglas generadas
 * con el motor de validación existente.
 *
 * Estas pruebas no requieren una conexión a PostgreSQL ni
 * realizan solicitudes a servicios externos.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { campaignConfig } from "./campaign.config";

import type {
  CampaignConfig,
} from "./campaign.types";

import {
  CampaignConfigError,
  validateCampaignConfig,
  buildCampaignValidationRules,
} from "./validateCampaignConfig";

import {
  validateTicket,
} from "../modules/tickets/validation/engine";

/**
 * Genera una copia independiente de la configuración de campaña.
 *
 * Evita que las modificaciones realizadas por una prueba afecten
 * a la configuración original o a otros escenarios de prueba.
 */
function createConfig(): CampaignConfig {
  return structuredClone(campaignConfig);
}

// ============================================================
// Validación de los datos generales de campaña
// ============================================================

/**
 * Comprueba que la configuración de desarrollo pueda utilizarse
 * sin generar errores de validación.
 */
test("Acepta la configuración de campaña actual", () => {
  assert.doesNotThrow(() => {
    validateCampaignConfig(createConfig());
  });
});

/**
 * Impide utilizar identificadores con espacios o mayúsculas.
 */
test("Rechaza un identificador de campaña inválido", () => {
  const config = createConfig();

  config.id = "Pauta Demo";

  assert.throws(
    () => validateCampaignConfig(config),
    CampaignConfigError,
  );
});

/**
 * Comprueba que el nombre de campaña sea obligatorio.
 */
test("Rechaza un nombre de campaña vacío", () => {
  const config = createConfig();

  config.name = "   ";

  assert.throws(
    () => validateCampaignConfig(config),
    /nombre de campaña/,
  );
});

/**
 * Impide utilizar zonas horarias no reconocidas por el entorno.
 */
test("Rechaza una zona horaria inválida", () => {
  const config = createConfig();

  config.timezone = "Mexico/Invalid";

  assert.throws(
    () => validateCampaignConfig(config),
    /zona horaria/,
  );
});

// ============================================================
// Validación de la vigencia de compra
// ============================================================

/**
 * Comprueba que no se acepten fechas inexistentes, incluso
 * cuando la regla de vigencia está deshabilitada.
 */
test("Rechaza una fecha de compra inexistente", () => {
  const config = createConfig();

  config.tickets.validationRules
    .purchaseDateRange.startDate = "2026-02-30";

  assert.throws(
    () => validateCampaignConfig(config),
    /periodo de compra/,
  );
});

/**
 * Garantiza que las fechas configuradas representen días
 * completos y no valores que incluyan una hora.
 *
 * Esta restricción corresponde a la configuración de campaña,
 * no a la respuesta original de Veryfi.
 */
test("Rechaza fechas de configuración con hora", () => {
  const config = createConfig();

  config.tickets.validationRules
    .purchaseDateRange.startDate =
      "2026-12-01 00:00:00";

  assert.throws(
    () => validateCampaignConfig(config),
    /periodo de compra/,
  );
});

/**
 * Impide configurar un periodo cuya fecha inicial sea
 * posterior a su fecha final.
 */
test("Rechaza un periodo de compra invertido", () => {
  const config = createConfig();

  const rule =
    config.tickets.validationRules.purchaseDateRange;

  rule.startDate = "2026-12-31";
  rule.endDate = "2026-12-01";

  assert.throws(
    () => validateCampaignConfig(config),
    /periodo de compra/,
  );
});

/**
 * Comprueba que una campaña pueda permitir compras durante
 * un único día, debido a que ambos límites son inclusivos.
 */
test("Acepta un periodo de compra de un solo día", () => {
  const config = createConfig();

  const rule =
    config.tickets.validationRules.purchaseDateRange;

  rule.startDate = "2026-12-15";
  rule.endDate = "2026-12-15";

  assert.doesNotThrow(() => {
    validateCampaignConfig(config);
  });
});

// ============================================================
// Validación del importe mínimo y moneda
// ============================================================

/**
 * Impide configurar importes mínimos negativos.
 */
test("Rechaza un importe mínimo negativo", () => {
  const config = createConfig();

  config.tickets.validationRules
    .minimumAmount.minimum = -150;

  assert.throws(
    () => validateCampaignConfig(config),
    /minimumAmount.minimum/,
  );
});

/**
 * Comprueba que el importe mínimo sea un número finito.
 */
test("Rechaza un importe mínimo infinito", () => {
  const config = createConfig();

  config.tickets.validationRules
    .minimumAmount.minimum = Infinity;

  assert.throws(
    () => validateCampaignConfig(config),
    /minimumAmount.minimum/,
  );
});

/**
 * Verifica que la moneda utilice el formato requerido de
 * tres letras mayúsculas.
 */
test("Rechaza una moneda inválida", () => {
  const config = createConfig();

  config.tickets.validationRules
    .minimumAmount.currency = "pesos";

  assert.throws(
    () => validateCampaignConfig(config),
    /minimumAmount.currency/,
  );
});

// ============================================================
// Validación de comercios participantes
// ============================================================

/**
 * Comprueba que la regla contenga al menos un comercio.
 */
test("Rechaza una lista de comercios vacía", () => {
  const config = createConfig();

  config.tickets.validationRules
    .allowedMerchants.merchants = [];

  assert.throws(
    () => validateCampaignConfig(config),
    /allowedMerchants.merchants/,
  );
});

/**
 * Impide utilizar nombres que pierdan todo su contenido
 * durante el proceso de normalización.
 */
test("Rechaza un comercio con nombre inválido", () => {
  const config = createConfig();

  config.tickets.validationRules
    .allowedMerchants.merchants = [
      {
        name: "---",
      },
    ];

  assert.throws(
    () => validateCampaignConfig(config),
    /name es inválido/,
  );
});

/**
 * Comprueba que los alias de comercios contengan texto válido.
 */
test("Rechaza alias de comercios vacíos", () => {
  const config = createConfig();

  config.tickets.validationRules
    .allowedMerchants.merchants = [
      {
        name: "Walmart",
        aliases: ["   "],
      },
    ];

  assert.throws(
    () => validateCampaignConfig(config),
    /aliases es inválido/,
  );
});

/**
 * Permite diferentes representaciones del mismo comercio
 * cuando pertenecen a un único elemento de configuración.
 */
test("Permite alias equivalentes al nombre del mismo comercio", () => {
  const config = createConfig();

  config.tickets.validationRules
    .allowedMerchants.merchants = [
      {
        name: "Walmart",
        aliases: ["Wal-Mart"],
      },
    ];

  assert.doesNotThrow(() => {
    validateCampaignConfig(config);
  });
});

/**
 * Detecta alias ambiguos entre comercios diferentes, aunque
 * sus representaciones originales no sean idénticas.
 */
test("Rechaza alias compartidos por diferentes comercios", () => {
  const config = createConfig();

  config.tickets.validationRules
    .allowedMerchants.merchants = [
      {
        name: "Walmart",
        aliases: ["Supermercado"],
      },
      {
        name: "Soriana",
        aliases: ["Super Mercado"],
      },
    ];

  assert.throws(
    () => validateCampaignConfig(config),
    /pertenece a otro elemento/,
  );
});

// ============================================================
// Validación de productos participantes
// ============================================================

/**
 * Garantiza que la cantidad mínima requerida sea positiva.
 */
test("Rechaza una cantidad mínima igual a cero", () => {
  const config = createConfig();

  config.tickets.validationRules
    .requiredProducts.minimumQuantity = 0;

  assert.throws(
    () => validateCampaignConfig(config),
    /minimumQuantity/,
  );
});

/**
 * Impide configurar cantidades mínimas fraccionarias.
 */
test("Rechaza una cantidad mínima decimal", () => {
  const config = createConfig();

  config.tickets.validationRules
    .requiredProducts.minimumQuantity = 1.5;

  assert.throws(
    () => validateCampaignConfig(config),
    /minimumQuantity/,
  );
});

/**
 * Comprueba que la regla contenga al menos un producto.
 */
test("Rechaza una lista de productos vacía", () => {
  const config = createConfig();

  config.tickets.validationRules
    .requiredProducts.products = [];

  assert.throws(
    () => validateCampaignConfig(config),
    /requiredProducts.products/,
  );
});

/**
 * Impide que una misma descripción normalizada identifique
 * dos productos diferentes de la campaña.
 */
test("Rechaza alias compartidos por diferentes productos", () => {
  const config = createConfig();

  config.tickets.validationRules
    .requiredProducts.products = [
      {
        name: "Coca-Cola 600 ml",
        aliases: ["Refresco 600"],
      },
      {
        name: "Sprite 600 ml",
        aliases: ["REFRESCO-600"],
      },
    ];

  assert.throws(
    () => validateCampaignConfig(config),
    /pertenece a otro elemento/,
  );
});

// ============================================================
// Validación de las propiedades comunes de las reglas
// ============================================================

/**
 * Comprueba que únicamente se admitan las acciones de
 * incumplimiento reconocidas por el motor.
 *
 * Object.assign permite simular un valor inválido que no
 * podría asignarse directamente mediante el tipo TypeScript.
 */
test("Rechaza una acción de incumplimiento inválida", () => {
  const config = createConfig();

  Object.assign(
    config.tickets.validationRules.minimumAmount,
    {
      failureAction: "approved",
    },
  );

  assert.throws(
    () => validateCampaignConfig(config),
    /failureAction/,
  );
});

/**
 * Comprueba que el estado de habilitación sea un booleano
 * real y no una representación textual.
 */
test("Rechaza un indicador enabled inválido", () => {
  const config = createConfig();

  Object.assign(
    config.tickets.validationRules.duplicateTicket,
    {
      enabled: "true",
    },
  );

  assert.throws(
    () => validateCampaignConfig(config),
    /enabled debe ser booleano/,
  );
});

// ============================================================
// Transformación de las reglas de campaña
// ============================================================

/**
 * Verifica la estructura completa de las cinco reglas
 * generadas a partir de la configuración de desarrollo.
 *
 * Comprueba los identificadores, parámetros, acciones de
 * incumplimiento y estados de habilitación esperados.
 *
 * Los valores esperados corresponden a la configuración
 * actual y deberán actualizarse cuando esta cambie.
 */
test("Transforma las cinco reglas al formato de PostgreSQL", () => {
  const rules = buildCampaignValidationRules(
    createConfig(),
  );

  assert.deepEqual(rules, [
    {
      rule_type: "purchase_date_range",
      configuration: {
        start_date: "2026-12-01",
        end_date: "2026-12-31",
      },
      failure_action: "rejected",
      is_enabled: false,
    },
    {
      rule_type: "minimum_amount",
      configuration: {
        minimum: 150,
        currency: "MXN",
      },
      failure_action: "rejected",
      is_enabled: true,
    },
    {
      rule_type: "allowed_merchants",
      configuration: {
        merchants: [
          "Walmart",
          "Soriana",
          "Chedraui",
        ],
        aliases: {
          Walmart: [
            "Wal-Mart",
            "Walmart Supercenter",
          ],
          Soriana: [
            "Soriana Híper",
            "Soriana Mercado",
          ],
        },
      },
      failure_action: "rejected",
      is_enabled: true,
    },
    {
      rule_type: "required_products",
      configuration: {
        products: [
          {
            name: "Coca-Cola 600 ml",
            aliases: [
              "Coca Cola 600ML",
              "Coca-Cola PET 600",
            ],
          },
          {
            name: "Sprite 600 ml",
            aliases: [
              "Sprite PET 600",
            ],
          },
        ],
        minimum_quantity: 1,
      },
      failure_action: "requires_review",
      is_enabled: true,
    },
    {
      rule_type: "duplicate_ticket",
      configuration: {},
      failure_action: "rejected",
      is_enabled: true,
    },
  ]);
});

/**
 * Comprueba que la transformación no altere los valores
 * de la configuración que recibe.
 */
test("La transformación no modifica la configuración original", () => {
  const config = createConfig();

  const original = structuredClone(config);

  buildCampaignValidationRules(config);

  assert.deepEqual(config, original);
});

/**
 * Garantiza que no se generen reglas cuando la configuración
 * contiene parámetros inválidos.
 */
test("Impide transformar una configuración inválida", () => {
  const config = createConfig();

  config.tickets.validationRules
    .minimumAmount.minimum = -1;

  assert.throws(
    () => buildCampaignValidationRules(config),
    CampaignConfigError,
  );
});

// ============================================================
// Compatibilidad con el motor de validación
// ============================================================

/**
 * Comprueba que las reglas transformadas puedan utilizarse
 * directamente con el motor de validación existente.
 *
 * Simula un comprobante que cumple con las cinco reglas,
 * utilizando información previamente normalizada.
 *
 * Esta prueba no realiza procesamiento OCR ni consultas
 * reales para detectar comprobantes duplicados.
 */
test("Las reglas generadas son compatibles con el motor existente", () => {
  const config = createConfig();

  // Habilita temporalmente la vigencia para comprobar
  // el funcionamiento conjunto de las cinco reglas.
  config.tickets.validationRules
    .purchaseDateRange.enabled = true;

  // Simula los identificadores que PostgreSQL asignaría
  // a las reglas durante su almacenamiento.
  const rules = buildCampaignValidationRules(
    config,
  ).map((rule, index) => ({
    ...rule,
    id: String(index + 1),
  }));

  // Simula los datos normalizados de un comprobante válido.
  const result = validateTicket(
    {
      merchant_name: "Walmart Supercenter",
      purchase_date: "2026-12-15",
      total_amount: 200,
      currency: "MXN",
      products: [
        {
          description: "Coca-Cola 600 ml",
          quantity: 1,
        },
      ],
      file_hash: "a".repeat(64),
      duplicate_ticket_id: null,
      veryfi_duplicate_status: "not_duplicate",
    },
    rules,
  );

  // El comprobante debe aprobarse y cumplir las cinco reglas.
  assert.equal(result.status, "approved");
  assert.equal(result.results.length, 5);

  assert.ok(
    result.results.every(
      (rule) => rule.passed === true,
    ),
  );
});
/**
 * Comprueba que los alias configurados para los productos
 * participantes sean reconocidos por el motor de validación.
 *
 * Simula comprobantes con diferentes descripciones obtenidas
 * mediante OCR para verificar que las reglas generadas
 * conserven correctamente los alias de cada producto.
 */
test("Reconoce los alias de productos configurados en la campaña", () => {
  const config = createConfig();

  // Genera las reglas con identificadores simulados,
  // tal como serían recuperadas desde PostgreSQL.
  const rules = buildCampaignValidationRules(
    config,
  ).map((rule, index) => ({
    ...rule,
    id: String(index + 1),
  }));

  // Descripciones alternativas recuperadas de la
  // configuración existente en PostgreSQL.
  const descriptions = [
    "Coca Cola 600ML",
    "Coca-Cola PET 600",
    "Sprite PET 600",
  ];

  for (const description of descriptions) {
    // Simula un comprobante válido que contiene un producto
    // identificado mediante uno de sus alias.
    const result = validateTicket(
      {
        merchant_name: "Walmart",
        purchase_date: "2026-12-15",
        total_amount: 200,
        currency: "MXN",
        products: [
          {
            description,
            quantity: 1,
          },
        ],
        file_hash: "a".repeat(64),
        duplicate_ticket_id: null,
        veryfi_duplicate_status: "not_duplicate",
      },
      rules,
    );

    // El uso de un alias válido no debe impedir
    // la aprobación automática del comprobante.
    assert.equal(
      result.status,
      "approved",
      `No se reconoció el alias: ${description}`,
    );
  }
});
