
import type {
  ValidationRule,
  TicketData,
  RuleValidationResult,
} from "./types";

export function validateMinimumAmount(
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

  const minimum = rule.configuration.minimum;
  const requiredCurrency = rule.configuration.currency;

  if (
    rule.rule_type !== "minimum_amount" ||
    typeof minimum !== "number" ||
    !Number.isFinite(minimum) ||
    minimum < 0 ||
    typeof requiredCurrency !== "string" ||
    !/^[A-Z]{3}$/.test(requiredCurrency)
  ) {
    return result(null, "Configuración de compra mínima inválida.");
  }

  const amount = ticket.total_amount;

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return result(null, "No se pudo determinar el importe del ticket.");
  }

  if (
    typeof ticket.currency !== "string" ||
    ticket.currency.toUpperCase() !== requiredCurrency
  ) {
    return result(null, "No se pudo confirmar la moneda del ticket.");
  }

  if (amount < minimum) {
    return result(
      false,
      `El importe ${amount} ${requiredCurrency} es inferior al mínimo de ${minimum} ${requiredCurrency}.`,
    );
  }

  return result(true, "El ticket cumple con la compra mínima.");
}
