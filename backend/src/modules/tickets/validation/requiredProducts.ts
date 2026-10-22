
import type {
  ValidationRule,
  TicketData,
  RuleValidationResult,
} from "./types";

interface ConfiguredProduct {
  name: string;
  aliases?: string[];
}

function normalizeProduct(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isConfiguredProduct(
  value: unknown,
): value is ConfiguredProduct {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const product = value as Record<string, unknown>;

  return (
    typeof product.name === "string" &&
    normalizeProduct(product.name).length > 0 &&
    (
      product.aliases === undefined ||
      (
        Array.isArray(product.aliases) &&
        product.aliases.every(
          (alias) =>
            typeof alias === "string" &&
            normalizeProduct(alias).length > 0
        )
      )
    )
  );
}

export function validateRequiredProducts(
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

  if (rule.rule_type !== "required_products") {
    return result(null, "El tipo de regla no corresponde.");
  }

  const { products, minimum_quantity } = rule.configuration;

  if (
    !Array.isArray(products) ||
    products.length === 0 ||
    !products.every(isConfiguredProduct) ||
    typeof minimum_quantity !== "number" ||
    !Number.isSafeInteger(minimum_quantity) ||
    minimum_quantity < 1
  ) {
    return result(
      null,
      "La configuración de productos participantes es inválida.",
    );
  }

  if (!Array.isArray(ticket.products)) {
    return result(
      null,
      "No se pudo obtener la lista de productos del ticket.",
    );
  }

  if (
    ticket.products.length === 0 ||
    ticket.products.some(
      (product) =>
        !product ||
        typeof product.description !== "string" ||
        !normalizeProduct(product.description) ||
        (
          product.quantity !== undefined &&
          (
            typeof product.quantity !== "number" ||
            !Number.isSafeInteger(product.quantity) ||
            product.quantity < 1
          )
        )
    )
  ) {
    return result(
      null,
      "La información de productos del ticket está incompleta o es inválida.",
    );
  }

  const allowedNames = new Set<string>();

  for (const product of products) {
    allowedNames.add(normalizeProduct(product.name));

    for (const alias of product.aliases ?? []) {
      allowedNames.add(normalizeProduct(alias));
    }
  }

  let matchedQuantity = 0;

  for (const product of ticket.products) {
    const normalizedName = normalizeProduct(product.description);

    if (allowedNames.has(normalizedName)) {
      matchedQuantity += product.quantity ?? 1;
    }
  }

  if (matchedQuantity < minimum_quantity) {
    return result(
      false,
      `El ticket contiene ${matchedQuantity} unidades participantes; se requieren al menos ${minimum_quantity}.`,
    );
  }

  return result(
    true,
    `El ticket contiene ${matchedQuantity} unidades participantes y cumple con el mínimo requerido.`,
  );
}
