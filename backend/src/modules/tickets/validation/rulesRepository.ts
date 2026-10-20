
import { pool } from "../../../database/connection";

import type {
  ValidationRule,
  ValidationRuleType,
  ValidationFailureAction,
} from "./types";

interface ValidationRuleRow {
  id: string;
  rule_type: string;
  configuration: unknown;
  failure_action: string;
  is_enabled: boolean;
}

const supportedRuleTypes: ValidationRuleType[] = [
  "purchase_date_range",
  "minimum_amount",
  "allowed_merchants",
  "required_products",
  "duplicate_ticket",
];

function isValidationRuleType(
  value: string,
): value is ValidationRuleType {
  return supportedRuleTypes.includes(value as ValidationRuleType);
}

function isFailureAction(
  value: string,
): value is ValidationFailureAction {
  return (
    value === "rejected" ||
    value === "requires_review"
  );
}

export async function getActiveValidationRules(): Promise<
  ValidationRule[]
> {
  const result = await pool.query<ValidationRuleRow>(`
    SELECT
      id::text,
      rule_type,
      configuration,
      failure_action,
      is_enabled
    FROM validation_rules
    WHERE is_enabled = TRUE
    ORDER BY id ASC
  `);

  return result.rows.map((row) => {
    if (!isValidationRuleType(row.rule_type)) {
      throw new Error(
        `Tipo de regla desconocido: ${row.rule_type}`,
      );
    }

    if (!isFailureAction(row.failure_action)) {
      throw new Error(
        `Acción de validación inválida: ${row.failure_action}`,
      );
    }

    if (
      row.configuration === null ||
      typeof row.configuration !== "object" ||
      Array.isArray(row.configuration)
    ) {
      throw new Error(
        `Configuración inválida para la regla ${row.id}`,
      );
    }

    return {
      id: row.id,
      rule_type: row.rule_type,
      configuration: row.configuration as Record<string, unknown>,
      failure_action: row.failure_action,
      is_enabled: row.is_enabled,
    };
  });
}
