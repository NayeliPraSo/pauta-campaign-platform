
import type { VeryfiDocument } from "@veryfi/veryfi-sdk/lib/types/VeryfiDocument";
import type { TicketData, TicketProduct } from "../validation/types.js";

type OcrValue = unknown;

function unwrapValue(value: OcrValue): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value
  ) {
    return value.value;
  }

  return value;
}

function normalizeText(value: OcrValue): string | null {
  const unwrapped = unwrapValue(value);

  if (typeof unwrapped !== "string") {
    return null;
  }

  const normalized = unwrapped.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: OcrValue): number | null {
  const unwrapped = unwrapValue(value);

  if (
    typeof unwrapped !== "number" ||
    !Number.isFinite(unwrapped) ||
    unwrapped < 0
  ) {
    return null;
  }

  return unwrapped;
}

function normalizeDate(value: OcrValue): string | null {
  const date = normalizeText(value);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function normalizeProducts(
  items: VeryfiDocument["line_items"],
): TicketProduct[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const products: TicketProduct[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const description = normalizeText(item.description);

    // Los productos sin descripción válida se omiten.
    if (!description) {
      continue;
    }

    const quantity = normalizeNumber(item.quantity);
    const total = normalizeNumber(item.total);

    const product: TicketProduct = {
      description,
    };

    if (quantity !== null) {
      product.quantity = quantity;
    }

    if (total !== null) {
      product.total = total;
    }

    products.push(product);
  }

  return products;
}

export function normalizeVeryfiDocument(
  document: VeryfiDocument,
): TicketData {
  const merchantName = normalizeText(document.vendor?.name);
  const purchaseDate = normalizeDate(document.date);
  const totalAmount = normalizeNumber(document.total);
  const currency = normalizeText(document.currency_code);

  return {
    merchant_name: merchantName,
    purchase_date: purchaseDate,
    total_amount: totalAmount,
    currency: currency?.toUpperCase() ?? null,
    products: normalizeProducts(document.line_items),
  };
}
