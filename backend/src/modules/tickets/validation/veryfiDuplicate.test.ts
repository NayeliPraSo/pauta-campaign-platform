
import assert from "node:assert/strict";
import test from "node:test";

import { validateVeryfiDuplicate } from "./veryfiDuplicate";

test("Identifica el primer documento como no duplicado", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: false,
    duplicate_of: null,
    meta: {
      duplicates: [],
    },
  });

  assert.equal(result.is_duplicate, false);
  assert.equal(result.original_document_id, null);
  assert.deepEqual(result.matching_documents, []);
});

test("Detecta el segundo documento como duplicado del primero", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: true,
    duplicate_of: 515771049,
    meta: {
      duplicates: [
        {
          id: 515771049,
          score: 1,
        },
      ],
    },
  });

  assert.equal(result.is_duplicate, true);
  assert.equal(result.original_document_id, 515771049);
  assert.equal(result.matching_documents.length, 1);
  assert.equal(result.matching_documents[0]?.score, 1);
});

test("Detecta duplicados aunque no se proporcione el documento original", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: true,
    duplicate_of: null,
    meta: {
      duplicates: [],
    },
  });

  assert.equal(result.is_duplicate, true);
  assert.equal(result.original_document_id, null);
});

test("Solicita revisión ante referencias contradictorias", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: false,
    duplicate_of: 515771049,
    meta: {
      duplicates: [{ id: 515771049, score: 1 }],
    },
  });

  assert.equal(result.is_duplicate, null);
  assert.equal(result.original_document_id, 515771049);
});

test("Solicita revisión cuando faltan datos de duplicidad", () => {
  const result = validateVeryfiDuplicate({});

  assert.equal(result.is_duplicate, null);
  assert.equal(result.original_document_id, null);
});

test("No confunde un resultado negativo con referencias vacías", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: false,
    meta: {
      duplicates: [],
    },
  });

  assert.equal(result.is_duplicate, false);
});

test("No acepta identificadores de documento inválidos", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: true,
    duplicate_of: -1,
  });

  assert.equal(result.is_duplicate, true);
  assert.equal(result.original_document_id, null);
});

test("Conserva todas las coincidencias reportadas por Veryfi", () => {
  const result = validateVeryfiDuplicate({
    is_duplicate: true,
    duplicate_of: 515771049,
    meta: {
      duplicates: [
        { id: 515771049, score: 1 },
        { id: 515771050, score: 0.95 },
      ],
    },
  });

  assert.equal(result.is_duplicate, true);
  assert.equal(result.matching_documents.length, 2);
});
