/**
 * Inicializador de las reglas de validación de campaña.
 *
 * Permite registrar en PostgreSQL las reglas definidas en
 * campaign.config.ts mediante una operación explícita.
 *
 * La inicialización es transaccional e idempotente:
 *
 * - Si no existen reglas, registra la configuración completa.
 * - Si las reglas existentes son idénticas, no realiza cambios.
 * - Si existen diferencias, detiene la inicialización.
 *
 * Este inicializador no actualiza ni elimina reglas existentes.
 * Las modificaciones posteriores deberán realizarse mediante
 * un mecanismo de actualización independiente y autorizado.
 */

import "dotenv/config";

import { isDeepStrictEqual } from "node:util";

import { pool } from "./connection";

import { campaignConfig } from "../config/campaign.config";

import type {
  CampaignConfig,
} from "../config/campaign.types";

import {
  buildCampaignValidationRules,
} from "../config/validateCampaignConfig";

import type {
  CampaignValidationRule,
} from "../config/validateCampaignConfig";

/**
 * Estados posibles de una inicialización exitosa.
 *
 * initialized: las reglas fueron registradas por primera vez.
 * unchanged: las reglas existentes coinciden con la configuración.
 */
export type CampaignInitializationStatus =
  | "initialized"
  | "unchanged";

/**
 * Resultado de la inicialización de campaña.
 */
export interface CampaignInitializationResult {
  /** Estado final de la operación. */
  status: CampaignInitializationStatus;

  /** Cantidad total de reglas contempladas en la configuración. */
  ruleCount: number;
}

/**
 * Contrato mínimo de una conexión utilizada por el inicializador.
 *
 * Permite utilizar una conexión real de PostgreSQL o una
 * implementación simulada durante las pruebas unitarias.
 */
export interface CampaignInitializationClient {
  /**
   * Ejecuta una consulta SQL con parámetros opcionales.
   */
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{
    rows: Record<string, unknown>[];
  }>;

  /**
 * Libera la conexión después de finalizar la operación.
 *
 * Permite descartar la conexión cuando ocurre un error
 * que impide garantizar su reutilización segura.
 */
release(destroy?: boolean): void;
}

/**
 * Función encargada de proporcionar una conexión al inicializador.
 *
 * Su inyección permite realizar pruebas sin conectarse a
 * una base de datos real.
 */
export type CampaignInitializationConnect =
  () => Promise<CampaignInitializationClient>;

/**
 * Error generado cuando las reglas almacenadas en PostgreSQL
 * no coinciden con la configuración de campaña.
 *
 * Conserva las diferencias detectadas para facilitar su revisión
 * sin modificar automáticamente los registros existentes.
 */
export class CampaignInitializationConflictError
  extends Error {
  constructor(
    public readonly differences: string[],
  ) {
    super(
      "Las reglas existentes no coinciden con la configuración de campaña.",
    );

    this.name =
      "CampaignInitializationConflictError";
  }
}

/**
 * Compara las reglas esperadas con las almacenadas en PostgreSQL.
 *
 * Detecta diferencias en:
 *
 * - Reglas faltantes.
 * - Reglas adicionales.
 * - Parámetros de configuración.
 * - Acciones de incumplimiento.
 * - Estados de habilitación.
 *
 * La comparación profunda de objetos permite ignorar diferencias
 * en el orden de las propiedades JSON, pero conserva el orden
 * y contenido de los arreglos.
 *
 * @param expectedRules Reglas generadas desde la configuración.
 * @param existingRules Reglas almacenadas en PostgreSQL.
 * @returns Descripciones de las diferencias encontradas.
 */
function findRuleDifferences(
  expectedRules: CampaignValidationRule[],
  existingRules: Record<string, unknown>[],
): string[] {
  const differences: string[] = [];

  // Indexa las reglas existentes por su tipo para facilitar
  // la comparación individual con las reglas esperadas.
  const existingByType = new Map(
    existingRules.map((rule) => [
      rule.rule_type,
      rule,
    ]),
  );

  // Conserva los tipos esperados para identificar posteriormente
  // reglas adicionales que no formen parte de la configuración.
  const expectedTypes = new Set<string>(
    expectedRules.map((rule) => rule.rule_type),
  );

  for (const expected of expectedRules) {
    const existing = existingByType.get(
      expected.rule_type,
    );

    // Una regla faltante se considera un conflicto.
    // No se registra automáticamente si ya existen otras reglas.
    if (!existing) {
      differences.push(
        `${expected.rule_type}: regla faltante.`,
      );

      continue;
    }

    // Compara el contenido de la configuración JSON sin depender
    // del orden en el que PostgreSQL devuelve sus propiedades.
    if (
      !isDeepStrictEqual(
        existing.configuration,
        expected.configuration,
      )
    ) {
      differences.push(
        `${expected.rule_type}: configuración diferente.`,
      );
    }

    // Detecta cambios en la acción aplicada cuando una regla
    // determina que un comprobante no cumple sus condiciones.
    if (
      existing.failure_action !==
      expected.failure_action
    ) {
      differences.push(
        `${expected.rule_type}: acción de incumplimiento diferente.`,
      );
    }

    // Detecta diferencias entre reglas habilitadas y deshabilitadas.
    if (
      existing.is_enabled !==
      expected.is_enabled
    ) {
      differences.push(
        `${expected.rule_type}: estado de habilitación diferente.`,
      );
    }
  }

  // Identifica reglas almacenadas que no están contempladas
  // en la configuración actual de campaña.
  for (const existing of existingRules) {
    if (
      typeof existing.rule_type !== "string" ||
      !expectedTypes.has(existing.rule_type)
    ) {
      differences.push(
        `${String(existing.rule_type)}: regla no contemplada en la configuración.`,
      );
    }
  }

  return differences;
}

/**
 * Inicializa las reglas de validación de una campaña.
 *
 * Valida la configuración antes de solicitar una conexión.
 * Todas las operaciones de almacenamiento se realizan dentro
 * de una misma transacción para evitar inicializaciones parciales.
 *
 * Si existen reglas diferentes a las configuradas, la operación
 * se cancela sin sobrescribirlas.
 *
 * @param config Configuración de campaña que se desea inicializar.
 * @param connect Función que proporciona una conexión a PostgreSQL.
 * @returns Resultado de la inicialización.
 * @throws CampaignInitializationConflictError Si existen diferencias.
 */
export async function initializeCampaign(
  config: CampaignConfig,
  connect: CampaignInitializationConnect =
    () => pool.connect(),
): Promise<CampaignInitializationResult> {
  // Valida y transforma la configuración antes de realizar
  // cualquier operación contra la base de datos.
  const rules = buildCampaignValidationRules(
    config,
  );

  const client = await connect();

  // Permite determinar si es necesario intentar un ROLLBACK
  // cuando ocurre un error durante la operación.
  let transactionStarted = false;

  // Indica si la conexión debe descartarse del pool debido
  // a un error que impide garantizar su estado transaccional.
  let discardConnection = false;

  try {
    // Inicia una transacción para garantizar que las reglas
    // se registren completamente o no se registre ninguna.
    await client.query("BEGIN");

    transactionStarted = true;

    /**
     * Bloquea las escrituras concurrentes sobre validation_rules
     * durante la inicialización.
     *
     * SHARE ROW EXCLUSIVE MODE evita que dos inicializadores
     * modifiquen simultáneamente la tabla, sin impedir las
     * consultas SELECT ordinarias del motor de validación.
     *
     * PostgreSQL libera el bloqueo al finalizar la transacción.
     */
    await client.query(`
      LOCK TABLE validation_rules
      IN SHARE ROW EXCLUSIVE MODE
    `);

    // Recupera todas las reglas existentes, incluidas las
    // deshabilitadas, para comparar la configuración completa.
    const existing = await client.query(`
      SELECT
        rule_type,
        configuration,
        failure_action,
        is_enabled
      FROM validation_rules
      ORDER BY rule_type ASC
    `);

    if (existing.rows.length > 0) {
      // Si la tabla contiene reglas, únicamente se permite
      // continuar cuando coinciden con la configuración esperada.
      const differences = findRuleDifferences(
        rules,
        existing.rows,
      );

      if (differences.length > 0) {
        throw new CampaignInitializationConflictError(
          differences,
        );
      }

      // Las reglas ya coinciden con la configuración.
      // Finaliza la transacción sin realizar escrituras.
      await client.query("COMMIT");

      transactionStarted = false;

      return {
        status: "unchanged",
        ruleCount: rules.length,
      };
    }

    // La tabla está vacía. Registra todas las reglas,
    // conservando sus parámetros y estados de habilitación.
    for (const rule of rules) {
      // Utiliza consultas parametrizadas para separar los
      // valores de configuración de las instrucciones SQL.
      //
      // PostgreSQL genera automáticamente el identificador
      // y los valores predeterminados de cada registro.
      await client.query(
        `
          INSERT INTO validation_rules (
            rule_type,
            configuration,
            failure_action,
            is_enabled
          )
          VALUES ($1, $2::jsonb, $3, $4)
        `,
        [
          rule.rule_type,
          JSON.stringify(rule.configuration),
          rule.failure_action,
          rule.is_enabled,
        ],
      );
    }

    // Confirma las inserciones únicamente después de que
    // todas las reglas se hayan registrado correctamente.
    await client.query("COMMIT");

    transactionStarted = false;

    return {
      status: "initialized",
      ruleCount: rules.length,
    };
  } catch (error) {
  // Intenta revertir la transacción cuando ocurre un error
  // después de haberla iniciado correctamente.
  if (transactionStarted) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
        // Si la reversión falla, no podemos garantizar que
        // la conexión se encuentre en un estado reutilizable.
        discardConnection = true;

        // Registra el fallo de reversión sin sustituir
        // el error original que provocó la cancelación.
        console.error(
          "Error al revertir la inicialización de campaña:",
          rollbackError,
        );
      }
    }

    throw error;
  } finally {
    // Descarta las conexiones cuyo estado transaccional
    // no puede garantizarse después de un fallo de reversión.
    if (discardConnection) {
      client.release(true);
    } else {
      // Devuelve al pool las conexiones que no requieren descarte.
      client.release();
    }
  }
}

/**
 * Punto de entrada del comando campaign:init.
 *
 * Ejecuta la inicialización utilizando la configuración de
 * campaña y la conexión real a PostgreSQL.
 *
 * Informa el resultado mediante la consola y establece un
 * código de salida distinto de cero cuando ocurre un error.
 */
async function main(): Promise<void> {
  try {
    const result = await initializeCampaign(
      campaignConfig,
    );

    console.log(
      `Campaña: ${campaignConfig.name}`,
    );

    console.log(
      `Identificador: ${campaignConfig.id}`,
    );

    // Distingue entre una inicialización nueva y una
    // configuración que ya se encuentra registrada.
    if (result.status === "initialized") {
      console.log(
        `Inicialización completada: ${result.ruleCount} reglas registradas.`,
      );
    } else {
      console.log(
        `La campaña ya está inicializada: ${result.ruleCount} reglas sin modificaciones.`,
      );
    }
  } catch (error) {
    // Presenta las diferencias de configuración de manera
    // individual para facilitar su revisión.
    if (
      error instanceof
      CampaignInitializationConflictError
    ) {
      console.error(error.message);

      for (const difference of error.differences) {
        console.error(`- ${difference}`);
      }

      console.error(
        "No se modificaron las reglas existentes.",
      );
    } else {
      console.error(
        "Error al inicializar la campaña:",
        error,
      );
    }

    // Permite que la terminal y otros procesos identifiquen
    // que la inicialización no finalizó correctamente.
    process.exitCode = 1;
  } finally {
    // Cierra el pool al finalizar la ejecución del comando.
    // La función initializeCampaign no cierra el pool porque
    // puede utilizarse de manera independiente.
    await pool.end();
  }
}

// Ejecuta el comando únicamente cuando este archivo se invoca
// directamente. Importarlo desde las pruebas no ejecuta main()
// ni inicia automáticamente operaciones contra PostgreSQL.
if (require.main === module) {
  void main();
}
