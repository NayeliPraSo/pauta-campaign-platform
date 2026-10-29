
import assert from "node:assert/strict";
import { test } from "node:test";

import type { StorageService } from "../../services/storage/storage.types.js";

import {
  DuplicateTicketError,
  registerTicket,
  type RegisterTicketDependencies,
  type RegisterTicketInput,
} from "./tickets.service.js";

import { calculateBufferHash } from "./utils/fileHash.js";

const input: RegisterTicketInput = {
  participantId: "15",
  fileBuffer: Buffer.from("Comprobante de prueba"),
  originalFilename: "ticket.png",
  mimeType: "image/png",
};

const createdAt = new Date("2026-10-29T12:00:00.000Z");

const createdTicket = {
  id: "100",
  participantId: "15",
  status: "pending",
  createdAt,
};

function createMockStorage() {
  const savedFiles: string[] = [];
  const deletedFiles: string[] = [];

  const storage: StorageService = {
    async save() {
      const key =
        "550e8400-e29b-41d4-a716-446655440000.png";

      savedFiles.push(key);

      return { key };
    },

    async delete(key) {
      deletedFiles.push(key);
    },
  };

  return {
    storage,
    savedFiles,
    deletedFiles,
  };
}

test("Registra un ticket válido y conserva sus metadatos", async () => {
  const mock = createMockStorage();

  let receivedInput:
    | Parameters<
        NonNullable<RegisterTicketDependencies["insertTicket"]>
      >[0]
    | undefined;

  const result = await registerTicket(input, {
    findDuplicate: async () => null,
    storage: mock.storage,

    insertTicket: async (ticketInput) => {
      receivedInput = ticketInput;
      return createdTicket;
    },
  });

  assert.deepEqual(result, createdTicket);

  assert.deepEqual(receivedInput, {
    participantId: "15",
    originalFilename: "ticket.png",
    filePath:
      "550e8400-e29b-41d4-a716-446655440000.png",
    mimeType: "image/png",
    fileHash: calculateBufferHash(input.fileBuffer),
  });

  assert.equal(mock.savedFiles.length, 1);
  assert.equal(mock.deletedFiles.length, 0);
});

test("Rechaza un duplicado sin guardar el archivo", async () => {
  const mock = createMockStorage();

  let insertCalled = false;

  await assert.rejects(
    registerTicket(input, {
      findDuplicate: async () => ({
        id: "99",
        status: "rejected",
      }),

      storage: mock.storage,

      insertTicket: async () => {
        insertCalled = true;
        return createdTicket;
      },
    }),
    DuplicateTicketError,
  );

  assert.equal(mock.savedFiles.length, 0);
  assert.equal(mock.deletedFiles.length, 0);
  assert.equal(insertCalled, false);
});

test("Elimina el archivo ante un duplicado concurrente", async () => {
  const mock = createMockStorage();

  const databaseError = Object.assign(
    new Error("Violación de índice único"),
    {
      code: "23505",
      constraint: "tickets_file_hash_unique",
    },
  );

  await assert.rejects(
    registerTicket(input, {
      findDuplicate: async () => null,
      storage: mock.storage,

      insertTicket: async () => {
        throw databaseError;
      },
    }),
    DuplicateTicketError,
  );

  assert.equal(mock.savedFiles.length, 1);
  assert.deepEqual(
    mock.deletedFiles,
    mock.savedFiles,
  );
});

test("Elimina el archivo si falla PostgreSQL", async () => {
  const mock = createMockStorage();
  const databaseError = new Error("PostgreSQL no disponible");

  await assert.rejects(
    registerTicket(input, {
      findDuplicate: async () => null,
      storage: mock.storage,

      insertTicket: async () => {
        throw databaseError;
      },
    }),
    (error: unknown) => error === databaseError,
  );

  assert.deepEqual(
    mock.deletedFiles,
    mock.savedFiles,
  );
});

test("No inserta el ticket si falla el almacenamiento", async () => {
  const storageError = new Error(
    "No fue posible guardar el archivo",
  );

  let insertCalled = false;

  await assert.rejects(
    registerTicket(input, {
      findDuplicate: async () => null,

      storage: {
        async save() {
          throw storageError;
        },

        async delete() {},
      },

      insertTicket: async () => {
        insertCalled = true;
        return createdTicket;
      },
    }),
    (error: unknown) => error === storageError,
  );

  assert.equal(insertCalled, false);
});

test("Conserva el error original cuando falla la limpieza", async () => {
  const databaseError = new Error("Error de PostgreSQL");
  const cleanupError = new Error("Error al eliminar archivo");

  const originalConsoleError = console.error;
  const loggedErrors: unknown[][] = [];

  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    await assert.rejects(
      registerTicket(input, {
        findDuplicate: async () => null,

        storage: {
          async save() {
            return {
              key: "550e8400-e29b-41d4-a716-446655440000.png",
            };
          },

          async delete() {
            throw cleanupError;
          },
        },

        insertTicket: async () => {
          throw databaseError;
        },
      }),
      (error: unknown) => error === databaseError,
    );

    assert.equal(loggedErrors.length, 1);
    assert.equal(loggedErrors[0][1], cleanupError);
  } finally {
    console.error = originalConsoleError;
  }
});
