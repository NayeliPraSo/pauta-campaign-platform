
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateTicketFile } from "./validateTicketFile";

test("Acepta un archivo PDF con firma válida", () => {
  const buffer = Buffer.from("%PDF-1.7\nContenido de prueba");

  const result = validateTicketFile(buffer, "application/pdf");

  assert.equal(result.valid, true);
  assert.equal(result.detectedMimeType, "application/pdf");
  assert.equal(result.reason, null);
});

test("Acepta un archivo JPG con firma válida", () => {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

  const result = validateTicketFile(buffer, "image/jpeg");

  assert.equal(result.valid, true);
  assert.equal(result.detectedMimeType, "image/jpeg");
});

test("Acepta un archivo PNG con firma válida", () => {
  const buffer = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const result = validateTicketFile(buffer, "image/png");

  assert.equal(result.valid, true);
  assert.equal(result.detectedMimeType, "image/png");
});

test("Rechaza un archivo cuyo contenido no es válido", () => {
  const buffer = Buffer.from("Este archivo no es una imagen");

  const result = validateTicketFile(buffer, "image/png");

  assert.equal(result.valid, false);
  assert.equal(result.detectedMimeType, null);
});

test("Rechaza un archivo con tipo MIME falsificado", () => {
  const buffer = Buffer.from("%PDF-1.7\nContenido de prueba");

  const result = validateTicketFile(buffer, "image/png");

  assert.equal(result.valid, false);
  assert.equal(result.detectedMimeType, "application/pdf");
  assert.match(result.reason ?? "", /no coincide/);
});

test("Rechaza un archivo vacío", () => {
  const result = validateTicketFile(
    Buffer.alloc(0),
    "application/pdf",
  );

  assert.equal(result.valid, false);
  assert.equal(result.detectedMimeType, null);
});

test("Rechaza un archivo con firma incompleta", () => {
  const result = validateTicketFile(
    Buffer.from([0xff, 0xd8]),
    "image/jpeg",
  );

  assert.equal(result.valid, false);
});
