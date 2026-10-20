
import type {
  ValidationRule,
  TicketData,
  RuleValidationResult,
} from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validatePurchaseDateRange(
  rule: ValidationRule,
  ticket: TicketData,
): RuleValidationResult {
  const result = (
    passed: boolean | null,
    reason: string,
  ): RuleValidationResult => ({
    rule_id: rule.id,
    rule_type: rule.rule_type,
    passed,
    reason,
  });

  const startDate = rule.configuration.start_date;
  const endDate = rule.configuration.end_date;

  if (
    rule.rule_type !== "purchase_date_range" ||
    !isValidDate(startDate) ||
    !isValidDate(endDate) ||
    startDate > endDate
  ) {
    return result(null, "Configuración del periodo inválida.");
  }

  const purchaseDate = ticket.purchase_date;

  if (!isValidDate(purchaseDate)) {
    return result(
      null,
      "No se pudo determinar una fecha de compra válida.",
    );
  }

  if (purchaseDate < startDate || purchaseDate > endDate) {
    return result(
      false,
      `La fecha ${purchaseDate} está fuera del periodo permitido (${startDate} al ${endDate}).`,
    );
  }

  return result(
    true,
    "La fecha de compra está dentro del periodo permitido.",
  );
}
