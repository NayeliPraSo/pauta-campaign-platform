
import assert from "node:assert/strict";
import { test } from "node:test";
import { processVeryfiDocument } from "./veryfiDocument.service";

test("Rechaza un documento vacío", async () => {
  await assert.rejects(
    processVeryfiDocument(Buffer.alloc(0), "ticket.png"),
    /El documento está vacío/,
  );
});

test("Rechaza un nombre de archivo vacío", async () => {
  await assert.rejects(
    processVeryfiDocument(Buffer.from("contenido de prueba"), "  "),
    /El nombre del documento es obligatorio/,
  );
});
