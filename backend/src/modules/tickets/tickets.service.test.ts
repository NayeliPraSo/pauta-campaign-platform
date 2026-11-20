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

    processDocument: async () => ({
      id: 12345,
      vendor: null,
      total: 250,
    }),

    saveOcrResult: async () => {},
  });

  assert.deepEqual(result, {
    ...createdTicket,
    ocrStatus: "processed",
  });

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
  let processCalled = false;

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

      processDocument: async () => {
        processCalled = true;
        return { id: 12345 };
      },
    }),
    DuplicateTicketError,
  );

  assert.equal(mock.savedFiles.length, 0);
  assert.equal(mock.deletedFiles.length, 0);
  assert.equal(insertCalled, false);
  assert.equal(processCalled, false);
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

  let processCalled = false;

  await assert.rejects(
    registerTicket(input, {
      findDuplicate: async () => null,
      storage: mock.storage,

      insertTicket: async () => {
        throw databaseError;
      },

      processDocument: async () => {
        processCalled = true;
        return { id: 12345 };
      },
    }),
    DuplicateTicketError,
  );

  assert.equal(mock.savedFiles.length, 1);
  assert.deepEqual(
    mock.deletedFiles,
    mock.savedFiles,
  );
  assert.equal(processCalled, false);
});

test("Elimina el archivo si falla PostgreSQL", async () => {
  const mock = createMockStorage();
  const databaseError = new Error("PostgreSQL no disponible");

  let processCalled = false;

  await assert.rejects(
    registerTicket(input, {
      findDuplicate: async () => null,
      storage: mock.storage,

      insertTicket: async () => {
        throw databaseError;
      },

      processDocument: async () => {
        processCalled = true;
        return { id: 12345 };
      },
    }),
    (error: unknown) => error === databaseError,
  );

  assert.deepEqual(
    mock.deletedFiles,
    mock.savedFiles,
  );
  assert.equal(processCalled, false);
});

test("No inserta el ticket si falla el almacenamiento", async () => {
  const storageError = new Error(
    "No fue posible guardar el archivo",
  );

  let insertCalled = false;
  let processCalled = false;

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

      processDocument: async () => {
        processCalled = true;
        return { id: 12345 };
      },
    }),
    (error: unknown) => error === storageError,
  );

  assert.equal(insertCalled, false);
  assert.equal(processCalled, false);
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

test("Guarda los datos OCR devueltos por Veryfi", async () => {
  const mock = createMockStorage();

  const ocrDocument = {
    id: 12345,
    vendor: {
      name: "Comercio de prueba",
    },
    total: 250,
    is_duplicate: false,
  };

  let receivedOcr:
    | Parameters<
        NonNullable<RegisterTicketDependencies["saveOcrResult"]>
      >[0]
    | undefined;

  const result = await registerTicket(input, {
    findDuplicate: async () => null,
    storage: mock.storage,
    insertTicket: async () => createdTicket,

    processDocument: async () => ocrDocument,

    saveOcrResult: async (ocrInput) => {
      receivedOcr = ocrInput;
    },
  });

  assert.deepEqual(receivedOcr, {
    ticketId: "100",
    veryfiDocumentId: 12345,
    ocrData: ocrDocument,
    normalizedData: {
      merchant_name: "Comercio de prueba",
      purchase_date: null,
      total_amount: 250,
      currency: null,
      products: [],
    },
  });

  assert.equal(result.ocrStatus, "processed");
  assert.equal(result.status, "pending");
  assert.equal(mock.deletedFiles.length, 0);
});

test("Conserva el ticket cuando Veryfi falla", async () => {
  const mock = createMockStorage();
  let saveOcrCalled = false;

  const result = await registerTicket(input, {
    findDuplicate: async () => null,
    storage: mock.storage,
    insertTicket: async () => createdTicket,

    processDocument: async () => {
      throw new Error("Veryfi no disponible");
    },

    saveOcrResult: async () => {
      saveOcrCalled = true;
    },
  });

  assert.deepEqual(result, {
    ...createdTicket,
    ocrStatus: "pending",
  });

  assert.equal(saveOcrCalled, false);
  assert.equal(mock.savedFiles.length, 1);
  assert.equal(mock.deletedFiles.length, 0);
});

test("Conserva el ticket cuando falla el guardado OCR", async () => {
  const mock = createMockStorage();

  const result = await registerTicket(input, {
    findDuplicate: async () => null,
    storage: mock.storage,
    insertTicket: async () => createdTicket,

    processDocument: async () => ({
      id: 12345,
    }),

    saveOcrResult: async () => {
      throw new Error("PostgreSQL no disponible");
    },
  });

  assert.deepEqual(result, {
    ...createdTicket,
    ocrStatus: "pending",
  });

  assert.equal(mock.savedFiles.length, 1);
  assert.equal(mock.deletedFiles.length, 0);
});

test("No guarda OCR si Veryfi devuelve un ID inválido", async () => {
  const mock = createMockStorage();
  let saveOcrCalled = false;

  const result = await registerTicket(input, {
    findDuplicate: async () => null,
    storage: mock.storage,
    insertTicket: async () => createdTicket,

    processDocument: async () => ({
      id: null,
    }),

    saveOcrResult: async () => {
      saveOcrCalled = true;
    },
  });

  assert.equal(result.ocrStatus, "pending");
  assert.equal(saveOcrCalled, false);
  assert.equal(mock.savedFiles.length, 1);
  assert.equal(mock.deletedFiles.length, 0);
});
