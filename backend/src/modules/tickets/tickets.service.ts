import { calculateBufferHash } from "./utils/fileHash.js";
import { findTicketByFileHash } from "./duplicateRepository.js";
import { normalizeVeryfiDocument } from "./normalization/normalizeVeryfiDocument.js";

import {
  createTicket,
  saveTicketOcrResult,
  type CreatedTicket,
} from "./tickets.repository.js";

import { localStorageService } from "../../services/storage/localStorage.service.js";
import type { StorageService } from "../../services/storage/storage.types.js";

type ProcessDocument = typeof import(
  "../../services/veryfiDocument.service.js"
).processVeryfiDocument;

export interface RegisterTicketInput {
  participantId: string;
  fileBuffer: Buffer;
  originalFilename: string;
  mimeType: string;
}

export interface RegisterTicketDependencies {
  findDuplicate?: typeof findTicketByFileHash;
  insertTicket?: typeof createTicket;
  storage?: StorageService;
  processDocument?: ProcessDocument;
  saveOcrResult?: typeof saveTicketOcrResult;
}

export interface RegisterTicketResult extends CreatedTicket {
  ocrStatus: "processed" | "pending";
}

export class DuplicateTicketError extends Error {
  constructor() {
    super("Este comprobante ya fue registrado anteriormente.");
    this.name = "DuplicateTicketError";
  }
}

function isFileHashUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    constraint?: unknown;
  };

  return (
    databaseError.code === "23505" &&
    databaseError.constraint === "tickets_file_hash_unique"
  );
}

export async function registerTicket(
  input: RegisterTicketInput,
  dependencies: RegisterTicketDependencies = {},
): Promise<RegisterTicketResult> {
  const findDuplicate =
    dependencies.findDuplicate ?? findTicketByFileHash;

  const insertTicket =
    dependencies.insertTicket ?? createTicket;

  const storage =
    dependencies.storage ?? localStorageService;

  const saveOcrResult =
    dependencies.saveOcrResult ?? saveTicketOcrResult;

  // 1. Calcular el hash del archivo.
  const fileHash = calculateBufferHash(input.fileBuffer);

  // 2. Comprobar si existe un archivo idéntico.
  const existingTicket = await findDuplicate(fileHash);

  if (existingTicket) {
    throw new DuplicateTicketError();
  }

  // 3. Guardar el archivo original.
  const storedFile = await storage.save(
    input.fileBuffer,
    input.originalFilename,
  );

  let createdTicket: CreatedTicket;

  // 4. Registrar el ticket en PostgreSQL.
  try {
    createdTicket = await insertTicket({
      participantId: input.participantId,
      originalFilename: input.originalFilename,
      filePath: storedFile.key,
      mimeType: input.mimeType,
      fileHash,
    });
  } catch (error) {
    // Solo eliminamos el archivo si falla
    // el registro inicial del ticket.
    try {
      await storage.delete(storedFile.key);
    } catch (cleanupError) {
      console.error(
        "No fue posible eliminar el archivo tras fallar el registro:",
        cleanupError,
      );
    }

    if (isFileHashUniqueViolation(error)) {
      throw new DuplicateTicketError();
    }

    throw error;
  }

  // 5. Procesar el documento con Veryfi.
  // El ticket ya está registrado, por lo que
  // no debemos eliminar su archivo si falla el OCR.
  try {
    const processDocument =
      dependencies.processDocument ??
      (
        await import(
          "../../services/veryfiDocument.service.js"
        )
      ).processVeryfiDocument;

    const document = await processDocument(
      input.fileBuffer,
      input.originalFilename,
    );

    // 6. Validar el identificador de Veryfi.
    if (
      !document ||
      typeof document !== "object" ||
      typeof document.id !== "number" ||
      !Number.isSafeInteger(document.id) ||
      document.id <= 0
    ) {
      throw new Error(
        "Veryfi devolvió un identificador de documento inválido.",
      );
    }

    // 7. Normalizar los datos sin modificar la respuesta original.
    const normalizedData = normalizeVeryfiDocument(document);

    // 8. Guardar la respuesta OCR y los campos normalizados.
    await saveOcrResult({
      ticketId: createdTicket.id,
      veryfiDocumentId: document.id,
      ocrData: JSON.parse(
        JSON.stringify(document),
      ) as Record<string, unknown>,
      normalizedData,
    });

    return {
      ...createdTicket,
      ocrStatus: "processed",
    };
  } catch {
    // Si falla Veryfi o la persistencia OCR,
    // conservamos el ticket y su archivo.
    // No realizamos reintentos automáticos.
    return {
      ...createdTicket,
      ocrStatus: "pending",
    };
  }
}
