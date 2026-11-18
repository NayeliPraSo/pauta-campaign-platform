
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createTicket,
  listParticipantTickets,
  type CreateTicketInput,
  type CreateTicketQuery,
  type ListParticipantTicketsQuery,
  saveTicketOcrResult,
  type SaveTicketOcrResultQuery,
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


test(
  "Consulta únicamente los tickets del participante indicado",
  async () => {
    let capturedSql = "";
    let capturedValues: readonly string[] = [];

    const mockQuery: ListParticipantTicketsQuery = async (
      sql,
      values,
    ) => {
      capturedSql = sql;
      capturedValues = values;

      return {
        rows: [
          {
            id: "7",
            original_filename: "Ticket de prueba.png",
            mime_type: "image/png",
            status: "pending",
            created_at: createdAt,
          },
        ],
      };
    };

    const tickets = await listParticipantTickets(
      "19",
      mockQuery,
    );

    assert.match(
      capturedSql,
      /WHERE participant_id = \$1/,
    );

    assert.match(
      capturedSql,
      /ORDER BY created_at DESC, id DESC/,
    );

    assert.deepEqual(capturedValues, ["19"]);

    assert.deepEqual(tickets, [
      {
        id: "7",
        originalFilename: "Ticket de prueba.png",
        mimeType: "image/png",
        status: "pending",
        createdAt,
      },
    ]);
  },
);

test(
  "Devuelve una lista vacía cuando el participante no tiene tickets",
  async () => {
    const mockQuery: ListParticipantTicketsQuery =
      async () => ({
        rows: [],
      });

    const tickets = await listParticipantTickets(
      "19",
      mockQuery,
    );

    assert.deepEqual(tickets, []);
  },
);

test(
  "Conserva identificadores BIGINT en el historial",
  async () => {
    const mockQuery: ListParticipantTicketsQuery =
      async () => ({
        rows: [
          {
            id: "9007199254740993",
            original_filename: "ticket.pdf",
            mime_type: "application/pdf",
            status: "approved",
            created_at: createdAt,
          },
        ],
      });

    const tickets = await listParticipantTickets(
      "19",
      mockQuery,
    );

    assert.equal(
      tickets[0]?.id,
      "9007199254740993",
    );
  },
);

test("Guarda el resultado OCR en el ticket indicado", async () => {
  let capturedSql = "";
  let capturedValues: readonly (string | number)[] = [];

  const ocrData = {
    id: 12345,
    vendor: { name: "Comercio de prueba" },
    total: 250,
  };

  const mockQuery: SaveTicketOcrResultQuery = async (
    sql,
    values,
  ) => {
    capturedSql = sql;
    capturedValues = values;

    return {
      rows: [{ id: "100" }],
    };
  };

  await saveTicketOcrResult(
    {
      ticketId: "100",
      veryfiDocumentId: 12345,
      ocrData,
    },
    mockQuery,
  );

  assert.match(capturedSql, /UPDATE tickets/);
  assert.match(capturedSql, /ocr_data = \$2::jsonb/);
  assert.match(capturedSql, /veryfi_document_id = \$3/);
  assert.match(capturedSql, /WHERE id = \$1/);
  assert.match(capturedSql, /status = 'pending'/);
  assert.doesNotMatch(capturedSql, /SET\s+status\s*=/);

  assert.deepEqual(capturedValues, [
    "100",
    JSON.stringify(ocrData),
    12345,
  ]);
});

test("Rechaza un identificador Veryfi inválido", async () => {
  let queryCalled = false;

  const mockQuery: SaveTicketOcrResultQuery = async () => {
    queryCalled = true;
    return { rows: [{ id: "100" }] };
  };

  await assert.rejects(
    saveTicketOcrResult(
      {
        ticketId: "100",
        veryfiDocumentId: 0,
        ocrData: {},
      },
      mockQuery,
    ),
    /identificador del documento Veryfi es inválido/,
  );

  assert.equal(queryCalled, false);
});

test("Detecta cuando no se actualiza el ticket", async () => {
  const mockQuery: SaveTicketOcrResultQuery = async () => ({
    rows: [],
  });

  await assert.rejects(
    saveTicketOcrResult(
      {
        ticketId: "100",
        veryfiDocumentId: 12345,
        ocrData: {},
      },
      mockQuery,
    ),
    /No fue posible guardar el resultado OCR/,
  );
});

test("Propaga errores de PostgreSQL al guardar OCR", async () => {
  const databaseError = new Error(
    "PostgreSQL no disponible",
  );

  const mockQuery: SaveTicketOcrResultQuery = async () => {
    throw databaseError;
  };

  await assert.rejects(
    saveTicketOcrResult(
      {
        ticketId: "100",
        veryfiDocumentId: 12345,
        ocrData: {},
      },
      mockQuery,
    ),
    (error: unknown) => error === databaseError,
  );
});
