
import type {
  ValidationRule,
  TicketData,
  RuleValidationResult,
} from "./types";

function normalizeMerchant(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function validateAllowedMerchants(
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

  if (rule.rule_type !== "allowed_merchants") {
    return result(null, "El tipo de regla no corresponde.");
  }

  const merchants = rule.configuration.merchants;

  if (
    !Array.isArray(merchants) ||
    merchants.length === 0 ||
    !merchants.every(
      (merchant) =>
        typeof merchant === "string" &&
        merchant.trim().length > 0,
    )
  ) {
    return result(
      null,
      "La configuración de comercios permitidos es inválida.",
    );
  }

  const merchantName = ticket.merchant_name;

  if (
    typeof merchantName !== "string" ||
    !merchantName.trim()
  ) {
    return result(
      null,
      "No se pudo identificar el comercio del ticket.",
    );
  }

  
  const normalizedMerchant = normalizeMerchant(merchantName);

  const aliases = rule.configuration.aliases;

  if (
    aliases !== undefined &&
    (
      aliases === null ||
      typeof aliases !== "object" ||
      Array.isArray(aliases)
    )
  ) {
    return result(
      null,
      "La configuración de alias de comercios es inválida.",
    );
  }

  const merchantAliases =
    (aliases ?? {}) as Record<string, unknown>;

  const allowedNames: string[] = [...merchants];

  for (const [merchant, names] of Object.entries(merchantAliases)) {
    const configuredMerchant = merchants.some(
      (allowed: string) =>
        normalizeMerchant(allowed) === normalizeMerchant(merchant),
    );

    if (
      !configuredMerchant ||
      !Array.isArray(names) ||
      !names.every(
        (name) =>
          typeof name === "string" &&
          name.trim().length > 0,
      )
    ) {
      return result(
        null,
        "La configuración de alias de comercios es inválida.",
      );
    }

    allowedNames.push(...names);
  }

  const isAllowed = allowedNames.some(
    (name) =>
      normalizeMerchant(name) === normalizedMerchant,
  );


  if (!isAllowed) {
    return result(
      false,
      `El comercio "${merchantName}" no está permitido en la campaña.`,
    );
  }

  return result(
    true,
    `El comercio "${merchantName}" está permitido.`,
  );
}
