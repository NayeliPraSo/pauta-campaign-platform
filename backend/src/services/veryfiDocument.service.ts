
import { veryfiClient } from "./veryfi.service";

export async function processVeryfiDocument(
  fileBuffer: Buffer,
  originalFilename: string,
) {
  if (fileBuffer.length === 0) {
    throw new Error("El documento está vacío.");
  }

  if (!originalFilename.trim()) {
    throw new Error("El nombre del documento es obligatorio.");
  }

  const fileBase64 = fileBuffer.toString("base64");

  return veryfiClient.process_document_from_base64(
    fileBase64,
    originalFilename,
    [],
    false,
  );
}
