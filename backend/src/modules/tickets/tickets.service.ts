
import { calculateBufferHash } from "./utils/fileHash.js";
import { findTicketByFileHash } from "./duplicateRepository.js";
import {
  createTicket,
  type CreatedTicket,
} from "./tickets.repository.js";

import { localStorageService } from "../../services/storage/localStorage.service.js";
import type { StorageService } from "../../services/storage/storage.types.js";

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
): Promise<CreatedTicket> {
  const findDuplicate =
    dependencies.findDuplicate ?? findTicketByFileHash;

  const insertTicket =
    dependencies.insertTicket ?? createTicket;

  const storage =
    dependencies.storage ?? localStorageService;

  const fileHash = calculateBufferHash(input.fileBuffer);

  const existingTicket = await findDuplicate(fileHash);

  if (existingTicket) {
    throw new DuplicateTicketError();
  }

  const storedFile = await storage.save(
    input.fileBuffer,
    input.originalFilename,
  );

  try {
    return await insertTicket({
      participantId: input.participantId,
      originalFilename: input.originalFilename,
      filePath: storedFile.key,
      mimeType: input.mimeType,
      fileHash,
    });
  } catch (error) {
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
}
