
import assert from "node:assert/strict";
import test from "node:test";

import {
  validateVeryfiDuplicateWithDatabase,
} from "./validateVeryfiDuplicateWithDatabase";

test("No consulta PostgreSQL cuando Veryfi no detecta duplicados", async () => {
  let lookupCalled = false;

  const result = await validateVeryfiDuplicateWithDatabase(
    {
      is_duplicate: false,
      duplicate_of: null,
      meta: { duplicates: [] },
    },
    async () => {
      lookupCalled = true;
      return null;
    },
  );

  assert.equal(result.status, "not_duplicate");
  assert.equal(lookupCalled, false);
});

test("Confirma un duplicado registrado en nuestra campaña", async () => {
  let searchedDocumentId: number | null = null;

  const result = await validateVeryfiDuplicateWithDatabase(
    {
      is_duplicate: true,
      duplicate_of: 515771049,
      meta: {
        duplicates: [
          { id: 515771049, score: 1 },
        ],
      },
    },
    async (documentId) => {
      searchedDocumentId = documentId;

      return {
        id: "6",
        status: "rejected",
      };
    },
  );

  assert.equal(searchedDocumentId, 515771049);
  assert.equal(result.status, "duplicate");
  assert.equal(result.original_document_id, 515771049);
  assert.equal(result.existing_ticket_id, "6");
});

test("Solicita revisión si el documento original no existe en la campaña", async () => {
  const result = await validateVeryfiDuplicateWithDatabase(
    {
      is_duplicate: true,
      duplicate_of: 515771049,
      meta: {
        duplicates: [
          { id: 515771049, score: 1 },
        ],
      },
    },
    async () => null,
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.original_document_id, 515771049);
  assert.equal(result.existing_ticket_id, null);
});

test("Solicita revisión si Veryfi no proporciona el documento original", async () => {
  let lookupCalled = false;

  const result = await validateVeryfiDuplicateWithDatabase(
    {
      is_duplicate: true,
      duplicate_of: null,
      meta: { duplicates: [] },
    },
    async () => {
      lookupCalled = true;
      return null;
    },
  );

  assert.equal(result.status, "requires_review");
  assert.equal(lookupCalled, false);
});

test("Solicita revisión cuando Veryfi devuelve información contradictoria", async () => {
  const result = await validateVeryfiDuplicateWithDatabase(
    {
      is_duplicate: false,
      duplicate_of: 515771049,
      meta: {
        duplicates: [
          { id: 515771049, score: 1 },
        ],
      },
    },
    async () => ({
      id: "6",
      status: "approved",
    }),
  );

  assert.equal(result.status, "requires_review");
  assert.equal(result.existing_ticket_id, null);
});

test("Solicita revisión cuando faltan los datos de duplicidad", async () => {
  const result = await validateVeryfiDuplicateWithDatabase(
    {},
    async () => null,
  );

  assert.equal(result.status, "requires_review");
});

test("Confirma duplicados independientemente del estado anterior", async () => {
  for (const status of [
    "pending",
    "processing",
    "approved",
    "rejected",
    "requires_review",
  ]) {
    const result = await validateVeryfiDuplicateWithDatabase(
      {
        is_duplicate: true,
        duplicate_of: 515771049,
      },
      async () => ({
        id: "6",
        status,
      }),
    );

    assert.equal(
      result.status,
      "duplicate",
      `No detectó el duplicado con estado ${status}`,
    );
  }
});

test("Propaga errores de PostgreSQL sin ocultarlos", async () => {
  await assert.rejects(
    validateVeryfiDuplicateWithDatabase(
      {
        is_duplicate: true,
        duplicate_of: 515771049,
      },
      async () => {
        throw new Error("Error de conexión de prueba");
      },
    ),
    /Error de conexión de prueba/,
  );
});
