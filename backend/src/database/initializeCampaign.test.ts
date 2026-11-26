/**
 * Pruebas unitarias del inicializador de campaña.
 *
 * Verifican el comportamiento de la inicialización, la
 * comparación de reglas existentes, el manejo de conflictos
 * y el control de transacciones.
 *
 * Utilizan conexiones simuladas para comprobar las consultas
 * SQL y sus parámetros sin modificar una base de datos real.
 *
 * Estas pruebas verifican las instrucciones de bloqueo y
 * reversión ejecutadas por el código, pero no sustituyen
 * las pruebas de integración con PostgreSQL.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { campaignConfig } from "../config/campaign.config";

import {
  CampaignConfigError,
  buildCampaignValidationRules,
} from "../config/validateCampaignConfig";

import {
  initializeCampaign,
  CampaignInitializationConflictError,
} from "./initializeCampaign";

import type {
  CampaignInitializationClient,
} from "./initializeCampaign";

/**
 * Opciones disponibles para configurar la conexión simulada.
 *
 * Permiten reproducir diferentes estados de la base de datos
 * y errores durante la ejecución de consultas.
 */
interface MockClientOptions {
  /** Reglas que devolverá la consulta SELECT simulada. */
  existingRules?: Record<string, unknown>[];

  /** Prefijo de la consulta SQL que debe generar un error. */
  failOn?: string;

  /** Número de inserción en la que debe producirse un error. */
  failOnInsertNumber?: number;

  /** Indica si la reversión de la transacción debe fallar. */
  failOnRollback?: boolean;
}

/**
 * Construye una conexión simulada para las pruebas.
 *
 * Registra las consultas SQL, sus parámetros y la cantidad
 * de conexiones, inserciones y liberaciones realizadas.
 *
 * Permite simular errores sin utilizar PostgreSQL y comprobar
 * el orden de las operaciones transaccionales.
 *
 * @param options Comportamiento esperado de la conexión.
 * @returns Conexión simulada y registros de sus operaciones.
 */
function createClientMock(
  options: MockClientOptions = {},
) {
  const statements: string[] = [];
  const parameters: unknown[][] = [];

  let releaseCount = 0;
  let connectionCount = 0;
  let insertCount = 0;
  // Registra las conexiones descartadas en lugar de reutilizadas.
  let discardCount = 0;

  const client: CampaignInitializationClient = {
    async query(sql, values = []) {
      // Normaliza los espacios de las consultas para facilitar
      // su comparación independientemente de la indentación.
      const statement = sql
        .trim()
        .replace(/\s+/g, " ");

      // Conserva las consultas y parámetros para comprobar
      // posteriormente las operaciones del inicializador.
      statements.push(statement);
      parameters.push(values);

      // Simula un error durante la reversión de una transacción
      // para comprobar el descarte seguro de la conexión.
      if (
        options.failOnRollback &&
        statement === "ROLLBACK"
      ) {
        throw new Error("Error simulado de reversión");
      }

      // Simula errores en instrucciones específicas,
      // como BEGIN, SELECT, LOCK TABLE o COMMIT.
      if (
        options.failOn &&
        statement.startsWith(options.failOn)
      ) {
        throw new Error("Error simulado");
      }

      // Registra los intentos de inserción y permite provocar
      // un error después de varias operaciones exitosas.
      if (
        statement.startsWith(
          "INSERT INTO validation_rules",
        )
      ) {
        insertCount++;

        if (
          insertCount === options.failOnInsertNumber
        ) {
          throw new Error(
            "Error simulado de inserción",
          );
        }
      }

      // Devuelve las reglas existentes configuradas para
      // el escenario de prueba correspondiente.
      if (statement.startsWith("SELECT")) {
        return {
          rows: options.existingRules ?? [],
        };
      }

      return {
        rows: [],
      };
    },

    // Registra la liberación de la conexión y distingue
    // aquellas que deben descartarse del pool.
    release(destroy = false) {
      releaseCount++;

      if (destroy) {
        discardCount++;
      }
    },
  };

  return {
    statements,
    parameters,

    get releaseCount() {
      return releaseCount;
    },

    // Permite verificar cuántas conexiones fueron descartadas.
    get discardCount() {
      return discardCount;
    },

    get connectionCount() {
      return connectionCount;
    },

    get insertCount() {
      return insertCount;
    },

    // Simula la obtención de una conexión y permite verificar
    // si el inicializador intentó acceder a la base de datos.
    async connect() {
      connectionCount++;

      return client;
    },
  };
}

/**
 * Genera una copia independiente de la configuración de campaña.
 *
 * Evita que las modificaciones realizadas por una prueba
 * afecten a la configuración original.
 */
function createConfig() {
  return structuredClone(campaignConfig);
}

/**
 * Genera reglas simuladas equivalentes a la configuración actual.
 *
 * Representa una base de datos previamente inicializada
 * con las reglas esperadas.
 */
function createExistingRules():
  Record<string, unknown>[] {
  return buildCampaignValidationRules(
    createConfig(),
  ).map((rule) => ({
    ...rule,
  }));
}

// ============================================================
// Validación previa a la inicialización
// ============================================================

/**
 * Garantiza que una configuración inválida detenga la operación
 * antes de solicitar una conexión a PostgreSQL.
 */
test("Valida la configuración antes de conectar a PostgreSQL", async () => {
  const config = createConfig();

  config.tickets.validationRules
    .minimumAmount.minimum = -1;

  const mock = createClientMock();

  await assert.rejects(
    () =>
      initializeCampaign(
        config,
        mock.connect,
      ),
    CampaignConfigError,
  );

  // No debe solicitar conexiones ni ejecutar consultas SQL.
  assert.equal(mock.connectionCount, 0);
  assert.equal(mock.statements.length, 0);
});

// ============================================================
// Inicialización de una tabla vacía
// ============================================================

/**
 * Comprueba que una tabla sin reglas pueda inicializarse
 * mediante una única transacción.
 *
 * Verifica el inicio de la transacción, el bloqueo de tabla,
 * la consulta de reglas, las inserciones y la confirmación.
 */
test("Inicializa las cinco reglas cuando la tabla está vacía", async () => {
  const mock = createClientMock();

  const result = await initializeCampaign(
    createConfig(),
    mock.connect,
  );

  assert.deepEqual(result, {
    status: "initialized",
    ruleCount: 5,
  });

  assert.equal(mock.insertCount, 5);
  assert.equal(mock.releaseCount, 1);

  assert.equal(
    mock.statements[0],
    "BEGIN",
  );

  // Comprueba que el bloqueo se solicite antes de consultar
  // las reglas existentes y realizar las inserciones.
  assert.equal(
    mock.statements[1],
    "LOCK TABLE validation_rules IN SHARE ROW EXCLUSIVE MODE",
  );

  assert.ok(
    mock.statements[2].startsWith("SELECT"),
  );

  assert.equal(
    mock.statements.at(-1),
    "COMMIT",
  );
});

/**
 * Verifica que las inserciones utilicen los parámetros
 * generados desde la configuración de campaña.
 *
 * Comprueba el tipo de regla, su configuración JSON,
 * la acción de incumplimiento y el estado de habilitación.
 */
test("Inserta las reglas con los parámetros esperados", async () => {
  const config = createConfig();

  const expectedRules =
    buildCampaignValidationRules(config);

  const mock = createClientMock();

  await initializeCampaign(
    config,
    mock.connect,
  );

  // Recupera únicamente los parámetros asociados con
  // las consultas de inserción de reglas.
  const insertedParameters =
    mock.parameters.filter(
      (_, index) =>
        mock.statements[index].startsWith(
          "INSERT INTO validation_rules",
        ),
    );

  assert.deepEqual(
    insertedParameters,
    expectedRules.map((rule) => [
      rule.rule_type,
      JSON.stringify(rule.configuration),
      rule.failure_action,
      rule.is_enabled,
    ]),
  );
});

/**
 * Comprueba que las reglas deshabilitadas también se registren
 * durante la inicialización, conservando su estado original.
 */
test("Conserva las reglas deshabilitadas durante la inicialización", async () => {
  const mock = createClientMock();

  await initializeCampaign(
    createConfig(),
    mock.connect,
  );

  const dateRule = mock.parameters.find(
    (values) =>
      values[0] === "purchase_date_range",
  );

  assert.ok(dateRule);

  // El cuarto parámetro corresponde a is_enabled.
  assert.equal(dateRule[3], false);
});

// ============================================================
// Idempotencia de la inicialización
// ============================================================

/**
 * Comprueba que ejecutar nuevamente el inicializador con
 * reglas idénticas no produzca nuevas inserciones.
 */
test("No modifica las reglas cuando la configuración es idéntica", async () => {
  const mock = createClientMock({
    existingRules: createExistingRules(),
  });

  const result = await initializeCampaign(
    createConfig(),
    mock.connect,
  );

  assert.deepEqual(result, {
    status: "unchanged",
    ruleCount: 5,
  });

  assert.equal(mock.insertCount, 0);

  assert.equal(
    mock.statements.at(-1),
    "COMMIT",
  );

  assert.equal(mock.releaseCount, 1);
});

/**
 * Comprueba que el orden de las propiedades de un objeto JSON
 * no genere conflictos de configuración.
 *
 * PostgreSQL puede devolver las propiedades JSONB en un orden
 * diferente al utilizado en el archivo de configuración.
 */
test("Acepta propiedades JSON almacenadas en diferente orden", async () => {
  const existingRules = createExistingRules();

  const rule = existingRules.find(
    (item) =>
      item.rule_type === "minimum_amount",
  );

  assert.ok(rule);

  // Conserva los valores originales, cambiando únicamente
  // el orden de las propiedades.
  rule.configuration = {
    currency: "MXN",
    minimum: 150,
  };

  const mock = createClientMock({
    existingRules,
  });

  const result = await initializeCampaign(
    createConfig(),
    mock.connect,
  );

  assert.equal(result.status, "unchanged");
  assert.equal(mock.insertCount, 0);
});

// ============================================================
// Detección de conflictos de configuración
// ============================================================

/**
 * Comprueba que un cambio en los parámetros de una regla
 * genere un conflicto y detenga la inicialización.
 *
 * Simula una diferencia en el importe mínimo de compra.
 */
test("Detecta diferencias en la configuración de una regla", async () => {
  const existingRules = createExistingRules();

  const rule = existingRules.find(
    (item) =>
      item.rule_type === "minimum_amount",
  );

  assert.ok(rule);

  rule.configuration = {
    minimum: 200,
    currency: "MXN",
  };

  const mock = createClientMock({
    existingRules,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          CampaignInitializationConflictError,
      );

      // Verifica que el error identifique la regla
      // y el tipo de diferencia detectada.
      assert.deepEqual(
        error.differences,
        [
          "minimum_amount: configuración diferente.",
        ],
      );

      return true;
    },
  );

  assert.equal(mock.insertCount, 0);

  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  assert.equal(mock.releaseCount, 1);
});

/**
 * Comprueba que un cambio en la acción de incumplimiento
 * se considere una diferencia de configuración.
 *
 * Evita que una política de revisión manual se sustituya
 * automáticamente por una política de rechazo.
 */
test("Detecta diferencias en la acción de incumplimiento", async () => {
  const existingRules = createExistingRules();

  const rule = existingRules.find(
    (item) =>
      item.rule_type === "required_products",
  );

  assert.ok(rule);

  rule.failure_action = "rejected";

  const mock = createClientMock({
    existingRules,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          CampaignInitializationConflictError,
      );

      assert.deepEqual(
        error.differences,
        [
          "required_products: acción de incumplimiento diferente.",
        ],
      );

      return true;
    },
  );

  assert.equal(mock.insertCount, 0);
});

/**
 * Comprueba que el inicializador no habilite ni deshabilite
 * automáticamente una regla previamente almacenada.
 */
test("Detecta diferencias en el estado de habilitación", async () => {
  const existingRules = createExistingRules();

  const rule = existingRules.find(
    (item) =>
      item.rule_type === "purchase_date_range",
  );

  assert.ok(rule);

  rule.is_enabled = true;

  const mock = createClientMock({
    existingRules,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          CampaignInitializationConflictError,
      );

      assert.deepEqual(
        error.differences,
        [
          "purchase_date_range: estado de habilitación diferente.",
        ],
      );

      return true;
    },
  );

  assert.equal(mock.insertCount, 0);
});

/**
 * Simula una base de datos que contiene únicamente una parte
 * de las reglas definidas en la configuración.
 *
 * Comprueba que las reglas faltantes no se agreguen
 * automáticamente sobre una configuración existente.
 */
test("Detecta reglas faltantes sin insertarlas automáticamente", async () => {
  const existingRules =
    createExistingRules().filter(
      (rule) =>
        rule.rule_type !== "purchase_date_range",
    );

  const mock = createClientMock({
    existingRules,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          CampaignInitializationConflictError,
      );

      assert.deepEqual(
        error.differences,
        [
          "purchase_date_range: regla faltante.",
        ],
      );

      return true;
    },
  );

  assert.equal(mock.insertCount, 0);
});

/**
 * Comprueba que las reglas adicionales almacenadas en
 * PostgreSQL también se consideren un conflicto.
 *
 * El inicializador no debe eliminar automáticamente reglas
 * que no estén contempladas en la configuración actual.
 */
test("Detecta reglas adicionales no contempladas en la configuración", async () => {
  const existingRules = createExistingRules();

  existingRules.push({
    rule_type: "unknown_rule",
    configuration: {},
    failure_action: "requires_review",
    is_enabled: true,
  });

  const mock = createClientMock({
    existingRules,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    (error: unknown) => {
      assert.ok(
        error instanceof
          CampaignInitializationConflictError,
      );

      assert.deepEqual(
        error.differences,
        [
          "unknown_rule: regla no contemplada en la configuración.",
        ],
      );

      return true;
    },
  );

  assert.equal(mock.insertCount, 0);
});

// ============================================================
// Manejo de errores y control de transacciones
// ============================================================

/**
 * Simula un error durante la tercera inserción.
 *
 * Comprueba que el inicializador solicite la reversión
 * de la transacción en lugar de confirmar una inicialización
 * parcial.
 */
test("Revierte la transacción si falla una inserción", async () => {
  const mock = createClientMock({
    failOnInsertNumber: 3,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado de inserción/,
  );

  assert.equal(mock.insertCount, 3);

  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  // No debe confirmarse una transacción que presentó errores.
  assert.ok(
    !mock.statements.includes("COMMIT"),
  );

  assert.equal(mock.releaseCount, 1);
});

/**
 * Comprueba que un error al consultar las reglas existentes
 * detenga la inicialización antes de realizar inserciones.
 */
test("Revierte la transacción si falla la consulta de reglas", async () => {
  const mock = createClientMock({
    failOn: "SELECT",
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado/,
  );

  assert.equal(mock.insertCount, 0);

  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  assert.equal(mock.releaseCount, 1);
});

/**
 * Comprueba que el inicializador no continúe cuando
 * no puede obtener el bloqueo requerido sobre la tabla.
 */
test("Revierte la transacción si falla el bloqueo de tabla", async () => {
  const mock = createClientMock({
    failOn: "LOCK TABLE",
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado/,
  );

  assert.equal(mock.insertCount, 0);

  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  assert.equal(mock.releaseCount, 1);
});

/**
 * Simula un error al iniciar la transacción.
 *
 * Comprueba que no se ejecuten operaciones adicionales
 * y que la conexión se libere correctamente.
 */
test("Libera la conexión si falla el inicio de la transacción", async () => {
  const mock = createClientMock({
    failOn: "BEGIN",
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado/,
  );

  // No se solicita ROLLBACK porque BEGIN no finalizó
  // correctamente y la transacción no se marcó como iniciada.
  assert.deepEqual(
    mock.statements,
    ["BEGIN"],
  );

  assert.equal(mock.releaseCount, 1);
});

/**
 * Simula un error durante la confirmación de la transacción.
 *
 * Comprueba que el inicializador intente ejecutar ROLLBACK,
 * propague el error y libere la conexión.
 *
 * La prueba verifica el intento de reversión, no garantiza
 * el resultado de una transacción real cuyo COMMIT haya fallado.
 */
test("Intenta revertir la transacción si falla COMMIT", async () => {
  const mock = createClientMock({
    failOn: "COMMIT",
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado/,
  );

  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  assert.equal(mock.releaseCount, 1);
});
/**
 * Comprueba que una conexión sea descartada cuando falla
 * la reversión de una transacción.
 *
 * Simula un error durante una inserción seguido de un
 * error durante ROLLBACK.
 *
 * El inicializador debe conservar el error original y
 * evitar que la conexión vuelva a utilizarse.
 */
test("Descarta la conexión si falla ROLLBACK", async () => {
  const mock = createClientMock({
    failOnInsertNumber: 3,
    failOnRollback: true,
  });

  // Comprueba que el error de reversión no sustituya
  // al error original de inserción.
  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado de inserción/,
  );

  assert.equal(mock.insertCount, 3);

  // Verifica que se haya intentado revertir la transacción.
  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  // Una transacción con errores no debe confirmarse.
  assert.ok(
    !mock.statements.includes("COMMIT"),
  );

  // La conexión debe liberarse una sola vez y descartarse.
  assert.equal(mock.releaseCount, 1);
  assert.equal(mock.discardCount, 1);
});
/**
 * Comprueba que una conexión pueda regresar al pool
 * cuando la transacción se revierte correctamente.
 *
 * Evita descartar conexiones innecesariamente ante
 * errores de inicialización que pudieron revertirse.
 */
test("Conserva la conexión si ROLLBACK finaliza correctamente", async () => {
  const mock = createClientMock({
    failOnInsertNumber: 3,
  });

  await assert.rejects(
    () =>
      initializeCampaign(
        createConfig(),
        mock.connect,
      ),
    /Error simulado de inserción/,
  );

  assert.equal(
    mock.statements.at(-1),
    "ROLLBACK",
  );

  // La conexión se libera normalmente porque
  // la reversión finalizó sin errores.
  assert.equal(mock.releaseCount, 1);
  assert.equal(mock.discardCount, 0);
});
