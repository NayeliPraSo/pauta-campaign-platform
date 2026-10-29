
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createTicket,
  type CreateTicketInput,
  type CreateTicketQuery,
} from "./tickets.repository.js";

const validInput: CreateTicketInput = {
  participantId: "15",
  originalFilename: "ticket.png",
  filePath: "550e8400-e29b-41d4-a716-446655440000.png",
  mimeType: "image/png",
  fileHash: "a".repeat(64),
};

const createdAt = new Date("2026-10-29T12:00:00.000Z");

test("Inserta un ticket con los parámetros esperados", async () => {
  let capturedSql = "";
  let capturedValues: readonly string[] = [];

  const mockQuery: CreateTicketQuery = async (
    sql,
    values,
  ) => {
    capturedSql = sql;
    capturedValues = values;

    return {
      rows: [
        {
          id: "100",
          participant_id: "15",
          status: "pending",
          created_at: createdAt,
        },
      ],
    };
  };

  const ticket = await createTicket(
    validInput,
    mockQuery,
  );

  assert.match(
    capturedSql,
    /INSERT INTO tickets/,
  );

  assert.match(
    capturedSql,
    /'pending'/,
  );

  assert.deepEqual(capturedValues, [
    "15",
    "ticket.png",
    "550e8400-e29b-41d4-a716-446655440000.png",
    "image/png",
    "a".repeat(64),
  ]);

  assert.deepEqual(ticket, {
    id: "100",
    participantId: "15",
    status: "pending",
    createdAt,
  });
});

test("Conserva identificadores BIGINT como cadenas", async () => {
  const mockQuery: CreateTicketQuery = async () => ({
    rows: [
      {
        id: "9007199254740993",
        participant_id: "9007199254740995",
        status: "pending",
        created_at: createdAt,
      },
    ],
  });

  const ticket = await createTicket(
    validInput,
    mockQuery,
  );

  assert.equal(
    ticket.id,
    "9007199254740993",
  );

  assert.equal(
    ticket.participantId,
    "9007199254740995",
  );
});

test("Rechaza una inserción sin filas devueltas", async () => {
  const mockQuery: CreateTicketQuery = async () => ({
    rows: [],
  });

  await assert.rejects(
    createTicket(validInput, mockQuery),
    /No fue posible recuperar el ticket registrado/,
  );
});

test("Propaga errores de PostgreSQL", async () => {
  const databaseError = Object.assign(
    new Error("duplicate key value violates unique constraint"),
    {
      code: "23505",
      constraint: "tickets_file_hash_unique",
    },
  );

  const mockQuery: CreateTicketQuery = async () => {
    throw databaseError;
  };

  await assert.rejects(
    createTicket(validInput, mockQuery),
    (error: unknown) => {
      assert.equal(error, databaseError);
      return true;
    },
  );
});
