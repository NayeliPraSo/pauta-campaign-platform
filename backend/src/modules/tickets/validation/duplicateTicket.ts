
import type {
  ValidationRule,
  TicketData,
  RuleValidationResult,
} from "./types";

export function validateDuplicateTicket(
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

  if (rule.rule_type !== "duplicate_ticket") {
    return result(
      null,
      "El tipo de regla no corresponde.",
    );
  }

  const validHash =
    typeof ticket.file_hash === "string" &&
    /^[a-f0-9]{64}$/.test(ticket.file_hash);

  const hashDuplicateId = ticket.duplicate_ticket_id;
  const veryfiStatus = ticket.veryfi_duplicate_status;

  // Un duplicado confirmado por cualquiera de los
  // dos mecanismos es suficiente para rechazarlo.
  if (
    validHash &&
    typeof hashDuplicateId === "string" &&
    /^[1-9]\d*$/.test(hashDuplicateId)
  ) {
    return result(
      false,
      `El archivo ya fue registrado en el ticket ${hashDuplicateId}.`,
    );
  }

  if (veryfiStatus === "duplicate") {
    return result(
      false,
      "Veryfi identificó un duplicado confirmado en la campaña.",
    );
  }

  // Mantener la validación estricta del hash.
  if (!validHash) {
    return result(
      null,
      "No se dispone de un hash SHA-256 válido para verificar duplicados.",
    );
  }

  if (hashDuplicateId === undefined) {
    return result(
      null,
      "Todavía no se ha realizado la consulta de duplicados.",
    );
  }

  if (
    hashDuplicateId !== null &&
    (
      typeof hashDuplicateId !== "string" ||
      !/^[1-9]\d*$/.test(hashDuplicateId)
    )
  ) {
    return result(
      null,
      "El resultado de la consulta de duplicados es inválido.",
    );
  }

  if (veryfiStatus === "requires_review") {
    return result(
      null,
      "La comprobación de duplicados de Veryfi requiere revisión.",
    );
  }

  if (
    veryfiStatus !== undefined &&
    veryfiStatus !== "not_duplicate"
  ) {
    return result(
      null,
      "El resultado de duplicados de Veryfi es inválido.",
    );
  }

  if (hashDuplicateId === null) {
    return result(
      true,
      veryfiStatus === "not_duplicate"
        ? "No se encontraron duplicados por SHA-256 ni por Veryfi."
        : "No se encontraron tickets con el mismo archivo.",
    );
  }

  return result(
    null,
    "No fue posible completar la verificación de duplicados.",
  );
}
