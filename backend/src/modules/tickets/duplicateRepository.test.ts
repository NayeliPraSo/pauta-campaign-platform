import "dotenv/config";

import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../database/connection";

import {
  findTicketByFileHash,
  findTicketByPurchaseData,
  findTicketByVeryfiDocumentId,
} from "./duplicateRepository";

test("Rechaza un número de ticket vacío", async () => {
  await assert.rejects(
    findTicketByPurchaseData({
      ticket_number: "   ",
      merchant_name: "Walmart",
      purchase_date: "2026-10-21",
    }),
    /número de ticket y el comercio son obligatorios/,
  );
});

test("Rechaza un comercio vacío", async () => {
  await assert.rejects(
    findTicketByPurchaseData({
      ticket_number: "12345",
      merchant_name: "   ",
      purchase_date: "2026-10-21",
    }),
    /número de ticket y el comercio son obligatorios/,
  );
});

test("Rechaza una fecha con formato inválido", async () => {
  await assert.rejects(
    findTicketByPurchaseData({
      ticket_number: "12345",
      merchant_name: "Walmart",
      purchase_date: "21/10/2026",
    }),
    /fecha de compra es inválida/,
  );
});

test("Rechaza una fecha inexistente", async () => {
  await assert.rejects(
    findTicketByPurchaseData({
      ticket_number: "12345",
      merchant_name: "Walmart",
      purchase_date: "2026-02-30",
    }),
    /fecha de compra es inválida/,
  );
});

test("Rechaza un mes inexistente", async () => {
  await assert.rejects(
    findTicketByPurchaseData({
      ticket_number: "12345",
      merchant_name: "Walmart",
      purchase_date: "2026-13-01",
    }),
    /fecha de compra es inválida/,
  );
});

test("Rechaza una fecha vacía", async () => {
  await assert.rejects(
    findTicketByPurchaseData({
      ticket_number: "12345",
      merchant_name: "Walmart",
      purchase_date: "",
    }),
    /fecha de compra es inválida/,
  );
});


test("Rechaza un identificador Veryfi igual a cero", async () => {
  await assert.rejects(
    findTicketByVeryfiDocumentId(0),
    /identificador del documento Veryfi es inválido/,
  );
});

test("Rechaza un identificador Veryfi negativo", async () => {
  await assert.rejects(
    findTicketByVeryfiDocumentId(-1),
    /identificador del documento Veryfi es inválido/,
  );
});

test("Rechaza un identificador Veryfi decimal", async () => {
  await assert.rejects(
    findTicketByVeryfiDocumentId(515771049.5),
    /identificador del documento Veryfi es inválido/,
  );
});

test("Rechaza un identificador Veryfi fuera del rango seguro", async () => {
  await assert.rejects(
    findTicketByVeryfiDocumentId(Number.MAX_SAFE_INTEGER + 1),
    /identificador del documento Veryfi es inválido/,
  );
});

test("Devuelve null cuando el documento Veryfi no está registrado", async () => {
  const result = await findTicketByVeryfiDocumentId(
    515771049,
  );

  assert.equal(result, null);
});

test("Excluye el ticket actual de la búsqueda por hash", async () => {
  const result = await pool.query<{
    id: string;
    status: string;
    file_hash: string;
  }>(`
    SELECT id::text AS id, status, file_hash
    FROM tickets
    WHERE file_hash ~ '^[a-f0-9]{64}$'
    ORDER BY id
    LIMIT 1
  `);

  const ticket = result.rows[0];
  assert.ok(ticket, "Se necesita un ticket registrado con un hash válido.");

  const expected = { id: ticket.id, status: ticket.status };
  assert.deepEqual(await findTicketByFileHash(ticket.file_hash), expected);
  assert.equal(await findTicketByFileHash(ticket.file_hash, ticket.id), null);

  const otherTicketId = ticket.id === "1" ? "2" : "1";
  assert.deepEqual(
    await findTicketByFileHash(ticket.file_hash, otherTicketId),
    expected,
  );
});

after(async () => {
  await pool.end();
});
