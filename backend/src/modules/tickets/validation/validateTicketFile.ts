
export type AllowedTicketMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export interface TicketFileValidationResult {
  valid: boolean;
  detectedMimeType: AllowedTicketMimeType | null;
  reason: string | null;
}

export function validateTicketFile(
  buffer: Buffer,
  declaredMimeType: string,
): TicketFileValidationResult {
  let detectedMimeType: AllowedTicketMimeType | null = null;

  // PDF: %PDF-
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
  ) {
    detectedMimeType = "application/pdf";
  }

  // JPG: FF D8 FF
  else if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    detectedMimeType = "image/jpeg";
  }

  // PNG: firma de 8 bytes
  else if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  ) {
    detectedMimeType = "image/png";
  }

  if (detectedMimeType === null) {
    return {
      valid: false,
      detectedMimeType: null,
      reason: "El contenido del archivo no corresponde a un PDF, JPG o PNG válido.",
    };
  }

  if (detectedMimeType !== declaredMimeType) {
    return {
      valid: false,
      detectedMimeType,
      reason: "El tipo de archivo declarado no coincide con su contenido.",
    };
  }

  return {
    valid: true,
    detectedMimeType,
    reason: null,
  };
}
