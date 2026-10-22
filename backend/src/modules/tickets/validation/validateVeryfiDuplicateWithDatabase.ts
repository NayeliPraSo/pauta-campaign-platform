
import {
  findTicketByVeryfiDocumentId,
} from "../duplicateRepository";

import {
  validateVeryfiDuplicate,
} from "./veryfiDuplicate";

import type {
  VeryfiDuplicateData,
} from "./veryfiDuplicate";

type DuplicateLookup = (
  documentId: number,
) => Promise<{ id: string; status: string } | null>;

export interface VeryfiDatabaseDuplicateResult {
  status: "duplicate" | "not_duplicate" | "requires_review";
  original_document_id: number | null;
  existing_ticket_id: string | null;
  reason: string;
}

export async function validateVeryfiDuplicateWithDatabase(
  document: VeryfiDuplicateData,
  findExisting: DuplicateLookup = findTicketByVeryfiDocumentId,
): Promise<VeryfiDatabaseDuplicateResult> {
  const result = validateVeryfiDuplicate(document);

  if (result.is_duplicate === false) {
    return {
      status: "not_duplicate",
      original_document_id: null,
      existing_ticket_id: null,
      reason: result.reason,
    };
  }

  if (result.is_duplicate === null) {
    return {
      status: "requires_review",
      original_document_id: result.original_document_id,
      existing_ticket_id: null,
      reason: result.reason,
    };
  }

  if (result.original_document_id === null) {
    return {
      status: "requires_review",
      original_document_id: null,
      existing_ticket_id: null,
      reason:
        "Veryfi detectó un duplicado, pero no identificó el documento original.",
    };
  }

  const existingTicket = await findExisting(
    result.original_document_id,
  );

  if (!existingTicket) {
    return {
      status: "requires_review",
      original_document_id: result.original_document_id,
      existing_ticket_id: null,
      reason:
        "Veryfi detectó un duplicado, pero el documento original no está registrado en esta campaña.",
    };
  }

  return {
    status: "duplicate",
    original_document_id: result.original_document_id,
    existing_ticket_id: existingTicket.id,
    reason: `El ticket ya fue registrado en esta campaña con el identificador ${existingTicket.id}.`,
  };
}
