
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  StorageService,
  StoredFile,
} from "./storage.types.js";

import { validateTicketFile } from "../../modules/tickets/validation/validateTicketFile.js";

const DEFAULT_STORAGE_ROOT = path.resolve(
  process.cwd(),
  "storage",
  "tickets",
);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_EXTENSIONS = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

export class LocalStorageService implements StorageService {
  constructor(
    private readonly storageRoot: string = DEFAULT_STORAGE_ROOT,
  ) {}

  async save(
    fileBuffer: Buffer,
    originalFilename: string,
  ): Promise<StoredFile> {
    if (
      fileBuffer.length === 0 ||
      fileBuffer.length > MAX_FILE_SIZE
    ) {
      throw new Error("El tamaño del archivo es inválido.");
    }

    // Determinamos el MIME esperado por la extensión.
    const extension = path.extname(
      originalFilename,
    ).toLowerCase();

    const declaredMimeType =
      extension === ".pdf"
        ? "application/pdf"
        : extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".png"
            ? "image/png"
            : null;

    if (!declaredMimeType) {
      throw new Error(
        "La extensión del archivo no está permitida.",
      );
    }

    // Verificamos que el contenido coincida
    // con el tipo esperado.
    const validation = validateTicketFile(
      fileBuffer,
      declaredMimeType,
    );

    if (!validation.valid || !validation.detectedMimeType) {
      throw new Error(
        validation.reason ??
          "El contenido del archivo no es válido.",
      );
    }

    // La extensión final proviene del contenido validado.
    const storedExtension =
      MIME_EXTENSIONS[validation.detectedMimeType];

    const filename = `${randomUUID()}${storedExtension}`;

    await mkdir(this.storageRoot, {
      recursive: true,
      mode: 0o700,
    });

    await writeFile(
      path.join(this.storageRoot, filename),
      fileBuffer,
      {
        flag: "wx",
        mode: 0o600,
      },
    );

    return {
      key: filename,
    };
  }

  async delete(key: string): Promise<void> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$/.test(
        key,
      )
    ) {
      throw new Error(
        "La referencia del archivo es inválida.",
      );
    }

    await unlink(path.join(this.storageRoot, key));
  }
}

export const localStorageService =
  new LocalStorageService();
