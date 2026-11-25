import { calculateBufferHash } from "./utils/fileHash.js";
import { findTicketByFileHash } from "./duplicateRepository.js";
import { normalizeVeryfiDocument } from "./normalization/normalizeVeryfiDocument.js";

import { getActiveValidationRules } from "./validation/rulesRepository.js";
import { validateTicketWithDatabase } from "./validation/validateTicketWithDatabase.js";
import { validateVeryfiDuplicateWithDatabase } from "./validation/validateVeryfiDuplicateWithDatabase.js";

import type { TicketData } from "./validation/types.js";

import {
  createTicket,
  saveTicketOcrResult,
  recordAutomaticTicketDecision,
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
  getActiveRules?: typeof getActiveValidationRules;
  validateRules?: typeof validateTicketWithDatabase;
  validateVeryfiDuplicate?: typeof validateVeryfiDuplicateWithDatabase;
  recordDecision?: typeof recordAutomaticTicketDecision;
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

  // 5. Procesar y guardar los datos OCR.
  let document: Awaited<ReturnType<ProcessDocument>>;
  let normalizedData: TicketData;

  try {
    const processDocument =
      dependencies.processDocument ??
      (
        await import(
          "../../services/veryfiDocument.service.js"
        )
      ).processVeryfiDocument;

    document = await processDocument(
      input.fileBuffer,
      input.originalFilename,
    );

    // Validar el identificador del documento de Veryfi.
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

    // Normalizar los datos sin modificar la respuesta original.
    normalizedData = normalizeVeryfiDocument(document);

    // Guardar la respuesta OCR y los campos normalizados.
    await saveOcrResult({
      ticketId: createdTicket.id,
      veryfiDocumentId: document.id,
      ocrData: JSON.parse(
        JSON.stringify(document),
      ) as Record<string, unknown>,
      normalizedData,
    });
  } catch (error) {
    // Conservamos el ticket y su archivo si falla
    // el procesamiento o almacenamiento del OCR.
    console.error(
      "No fue posible procesar el OCR del ticket:",
      error,
    );

    return {
      ...createdTicket,
      ocrStatus: "pending",
    };
  }

  // 6. Evaluar las reglas activas de la campaña.
  try {
    const getActiveRules =
      dependencies.getActiveRules ??
      getActiveValidationRules;

    const validateRules =
      dependencies.validateRules ??
      validateTicketWithDatabase;

    const validateVeryfiDuplicate =
      dependencies.validateVeryfiDuplicate ??
      validateVeryfiDuplicateWithDatabase;

    const recordDecision =
      dependencies.recordDecision ??
      recordAutomaticTicketDecision;

    // Consultar las reglas activas de la campaña.
    const rules = await getActiveRules();

    // Preparar los datos que utilizará el motor de validación.
    const ticketData: TicketData = {
      ...normalizedData,
      file_hash: fileHash,
    };

    // Comprobar si la regla de duplicados está habilitada.
    const duplicateRuleEnabled = rules.some(
      (rule) =>
        rule.rule_type === "duplicate_ticket" &&
        rule.is_enabled,
    );

    // Evaluar los duplicados identificados por Veryfi.
    if (duplicateRuleEnabled) {
      const duplicateResult =
        await validateVeryfiDuplicate(document);

      // Evitar que el ticket se considere duplicado
      // de sí mismo.
      ticketData.veryfi_duplicate_status =
        duplicateResult.existing_ticket_id === createdTicket.id
          ? "requires_review"
          : duplicateResult.status;
    }

    // Ejecutar las reglas excluyendo el ticket actual
    // de la búsqueda de duplicados por hash.
    const validation = await validateRules(
      ticketData,
      rules,
      findDuplicate,
      createdTicket.id,
    );

    // Identificar los resultados relevantes
    // para justificar la decisión automática.
    const relevantResults = validation.results.filter(
      (result) => {
        if (validation.status === "rejected") {
          return (
            result.passed === false &&
            rules.some(
              (rule) =>
                rule.id === result.rule_id &&
                rule.failure_action === "rejected",
            )
          );
        }

        if (validation.status === "requires_review") {
          return result.passed !== true;
        }

        return false;
      },
    );

    // Construir el motivo de la decisión.
    const reason =
      relevantResults
        .map((result) => result.reason)
        .filter(Boolean)
        .join(" ") ||
      (
        validation.status === "approved"
          ? "El comprobante cumple las reglas de participación."
          : validation.status === "requires_review"
            ? "El comprobante requiere una revisión adicional."
            : "El comprobante no cumple las reglas de participación."
      );

    // 7. Guardar el resultado y su auditoría.
    await recordDecision({
      ticketId: createdTicket.id,
      status: validation.status,
      reason,
      metadata: {
        results: validation.results,
      },
    });

    // 8. Devolver el ticket con su estado actualizado.
    return {
      ...createdTicket,
      status: validation.status,
      ocrStatus: "processed",
    };
  } catch (error) {
    // Si falla la validación automática, conservamos
    // el ticket pendiente y los datos OCR ya almacenados.
    console.error(
      "No fue posible completar la validación automática:",
      error,
    );

    return {
      ...createdTicket,
      ocrStatus: "processed",
    };
  }
}