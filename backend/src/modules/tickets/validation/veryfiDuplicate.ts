
export interface VeryfiDuplicateMatch {
  id: number;
  score?: number | null;
}

export interface VeryfiDuplicateData {
  is_duplicate?: boolean | null;
  duplicate_of?: number | null;
  meta?: {
    duplicates?: VeryfiDuplicateMatch[] | null;
  } | null;
}

export interface VeryfiDuplicateResult {
  is_duplicate: boolean | null;
  original_document_id: number | null;
  matching_documents: VeryfiDuplicateMatch[];
  reason: string;
}

export function validateVeryfiDuplicate(
  document: VeryfiDuplicateData,
): VeryfiDuplicateResult {
  const matches = document.meta?.duplicates ?? [];

  const originalDocumentId =
    typeof document.duplicate_of === "number" &&
    Number.isSafeInteger(document.duplicate_of) &&
    document.duplicate_of > 0
      ? document.duplicate_of
      : null;

  if (document.is_duplicate === true) {
    return {
      is_duplicate: true,
      original_document_id: originalDocumentId,
      matching_documents: matches,
      reason: "Veryfi identificó el documento como duplicado.",
    };
  }

  if (
    originalDocumentId !== null ||
    matches.length > 0
  ) {
    return {
      is_duplicate: null,
      original_document_id: originalDocumentId,
      matching_documents: matches,
      reason:
        "Veryfi devolvió referencias de duplicidad que requieren revisión.",
    };
  }

  if (document.is_duplicate === false) {
    return {
      is_duplicate: false,
      original_document_id: null,
      matching_documents: [],
      reason: "Veryfi no identificó duplicados.",
    };
  }

  return {
    is_duplicate: null,
    original_document_id: null,
    matching_documents: [],
    reason:
      "La respuesta de Veryfi no contiene información suficiente sobre duplicados.",
  };
}
