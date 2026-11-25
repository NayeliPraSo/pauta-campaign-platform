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
  recordAutomaticTicketDecision,
  type TicketDecisionClient,
} from "./tickets.repository.js";

const validInput: CreateTicketInput = {
  participantId: "15",
  originalFilename: "ticket.png",
  filePath: "550e8400-e29b-41d4-a716-446655440000.png",
  mimeType: "image/png",
  fileHash: "a".repeat(64),
};

const createdAt = new Date("2026-10-29T12:00:00.000Z");

const emptyNormalizedData = {
  merchant_name: null,
  purchase_date: null,
  total_amount: null,
  currency: null,
  products: [],
};


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
            merchant_name: "Chedraui",
            purchase_date: "2026-11-18",
            total_amount: "250.50",
            currency: "MXN",
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
        merchantName: "Chedraui",
        purchaseDate: "2026-11-18",
        totalAmount: 250.50,
        currency: "MXN",
        statusMessage: "Tu comprobante está pendiente de validación.",
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
            merchant_name: null,
            purchase_date: null,
            total_amount: null,
            currency: null,
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

    assert.equal(tickets[0]?.merchantName, null);
    assert.equal(tickets[0]?.purchaseDate, null);
    assert.equal(tickets[0]?.totalAmount, null);
    assert.equal(tickets[0]?.currency, null);
    assert.equal(
      tickets[0]?.statusMessage,
      "Tu comprobante fue aprobado.",
    );
  },
);

test("Guarda el resultado OCR en el ticket indicado", async () => {
  let capturedSql = "";
  let capturedValues: readonly (string | number | null)[] = [];

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
      normalizedData: {
        merchant_name: "Comercio de prueba",
        purchase_date: "2026-11-18",
        total_amount: 250,
        currency: "MXN",
        products: [],
      },
    },
    mockQuery,
  );

  assert.match(capturedSql, /UPDATE tickets/);
  assert.match(capturedSql, /ocr_data = \$2::jsonb/);
  assert.match(capturedSql, /veryfi_document_id = \$3/);
  assert.match(capturedSql, /merchant_name = \$4/);
  assert.match(capturedSql, /purchase_date = \$5::date/);
  assert.match(capturedSql, /total_amount = \$6/);
  assert.match(capturedSql, /currency = \$7/);
  assert.match(capturedSql, /WHERE id = \$1/);
  assert.match(capturedSql, /status = 'pending'/);
  assert.doesNotMatch(capturedSql, /SET\s+status\s*=/);

  assert.deepEqual(capturedValues, [
    "100",
    JSON.stringify(ocrData),
    12345,
    "Comercio de prueba",
    "2026-11-18",
    250,
    "MXN",
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
        normalizedData: emptyNormalizedData,
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
        normalizedData: emptyNormalizedData,
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
        normalizedData: emptyNormalizedData,
      },
      mockQuery,
    ),
    (error: unknown) => error === databaseError,
  );
});

test("Guarda OCR original y usa NULL para campos normalizados inválidos", async () => {
  let capturedValues: readonly (string | number | null)[] = [];
  const ocrData = { id: 12345, vendor: { name: "Dato original" } };

  const mockQuery: SaveTicketOcrResultQuery = async (_sql, values) => {
    capturedValues = values;
    return { rows: [{ id: "100" }] };
  };

  await saveTicketOcrResult({
    ticketId: "100",
    veryfiDocumentId: 12345,
    ocrData,
    normalizedData: {
      merchant_name: "x".repeat(256),
      purchase_date: "2026-02-30",
      total_amount: 10000000000,
      currency: "PESOS",
      products: [],
    },
  }, mockQuery);

  assert.deepEqual(capturedValues, [
    "100", JSON.stringify(ocrData), 12345, null, null, null, null,
  ]);
});

test("Conserva campos válidos aunque otros sean inválidos", async () => {
  let capturedValues: readonly (string | number | null)[] = [];
  const mockQuery: SaveTicketOcrResultQuery = async (_sql, values) => {
    capturedValues = values;
    return { rows: [{ id: "100" }] };
  };

  await saveTicketOcrResult({
    ticketId: "100",
    veryfiDocumentId: 12345,
    ocrData: { id: 12345 },
    normalizedData: {
      merchant_name: "Comercio válido",
      purchase_date: "2026-11-18",
      total_amount: 10.123,
      currency: "MXN",
      products: [],
    },
  }, mockQuery);

  assert.deepEqual(capturedValues.slice(3), [
    "Comercio válido", "2026-11-18", null, "MXN",
  ]);
});

function createDecisionClientMock(options?: {
  updateRows?: Array<Record<string, unknown>>;
  failOn?: "BEGIN" | "UPDATE" | "INSERT" | "COMMIT";
}) {
  const statements: string[] = [];
  const parameters: Array<readonly unknown[] | undefined> = [];
  let releaseCount = 0;

  const client: TicketDecisionClient = {
    async query(sql, values) {
      const statement = sql.trim();
      statements.push(statement);
      parameters.push(values);

      const operation = statement.split(/\s+/)[0];

      if (operation === options?.failOn) {
        throw new Error(`Error simulado en ${operation}`);
      }

      if (operation === "UPDATE") {
        return {
          rows: options?.updateRows ?? [{ id: "100" }],
        };
      }

      return { rows: [] };
    },

    release() {
      releaseCount++;
    },
  };

  return {
    client,
    statements,
    parameters,
    get releaseCount() {
      return releaseCount;
    },
  };
}

test("Registra una aprobación automática en una transacción", async () => {
  const mock = createDecisionClientMock();

  await recordAutomaticTicketDecision(
    {
      ticketId: "100",
      status: "approved",
      reason: "Cumple las reglas configuradas.",
      metadata: {
        validationResults: [],
      },
    },
    async () => mock.client,
  );

  assert.deepEqual(
    mock.statements.map((sql) => sql.split(/\s+/)[0]),
    ["BEGIN", "UPDATE", "INSERT", "COMMIT"],
  );

  assert.match(mock.statements[1], /status = 'pending'/);
  assert.match(mock.statements[1], /reviewed_at = CASE/);
  assert.match(mock.statements[2], /INSERT INTO ticket_reviews/);

  assert.deepEqual(mock.parameters[1], [
    "100",
    "approved",
    "Cumple las reglas configuradas.",
  ]);

  assert.deepEqual(mock.parameters[2], [
    "100",
    "approved",
    "Cumple las reglas configuradas.",
    JSON.stringify({ validationResults: [] }),
  ]);

  assert.equal(mock.releaseCount, 1);
});

test("Conserva NULL en reviewed_at para revisión humana pendiente", async () => {
  const mock = createDecisionClientMock();

  await recordAutomaticTicketDecision(
    {
      ticketId: "100",
      status: "requires_review",
    },
    async () => mock.client,
  );

  assert.match(
    mock.statements[1],
    /WHEN \$2::text IN \('approved', 'rejected'\) THEN NOW\(\)\s+ELSE NULL/,
  );

  assert.deepEqual(mock.parameters[1], [
    "100",
    "requires_review",
    null,
  ]);

  assert.equal(mock.releaseCount, 1);
});

test("Impide modificar un ticket que ya no está pendiente", async () => {
  const mock = createDecisionClientMock({
    updateRows: [],
  });

  await assert.rejects(
    recordAutomaticTicketDecision(
      {
        ticketId: "100",
        status: "rejected",
      },
      async () => mock.client,
    ),
    /El ticket no existe o ya no está pendiente/,
  );

  assert.deepEqual(
    mock.statements.map((sql) => sql.split(/\s+/)[0]),
    ["BEGIN", "UPDATE", "ROLLBACK"],
  );

  assert.equal(mock.releaseCount, 1);
});

test("Revierte la actualización cuando falla la auditoría", async () => {
  const mock = createDecisionClientMock({
    failOn: "INSERT",
  });

  await assert.rejects(
    recordAutomaticTicketDecision(
      {
        ticketId: "100",
        status: "rejected",
        reason: "Importe insuficiente.",
      },
      async () => mock.client,
    ),
    /Error simulado en INSERT/,
  );

  assert.deepEqual(
    mock.statements.map((sql) => sql.split(/\s+/)[0]),
    ["BEGIN", "UPDATE", "INSERT", "ROLLBACK"],
  );

  assert.equal(mock.releaseCount, 1);
});

test("Revierte la transacción cuando falla la actualización", async () => {
  const mock = createDecisionClientMock({
    failOn: "UPDATE",
  });

  await assert.rejects(
    recordAutomaticTicketDecision(
      {
        ticketId: "100",
        status: "approved",
      },
      async () => mock.client,
    ),
    /Error simulado en UPDATE/,
  );

  assert.deepEqual(
    mock.statements.map((sql) => sql.split(/\s+/)[0]),
    ["BEGIN", "UPDATE", "ROLLBACK"],
  );

  assert.equal(mock.releaseCount, 1);
});

test("Libera la conexión si falla el inicio de la transacción", async () => {
  const mock = createDecisionClientMock({
    failOn: "BEGIN",
  });

  await assert.rejects(
    recordAutomaticTicketDecision(
      {
        ticketId: "100",
        status: "approved",
      },
      async () => mock.client,
    ),
    /Error simulado en BEGIN/,
  );

  assert.equal(mock.releaseCount, 1);
});

test("Rechaza identificadores inválidos sin abrir conexión", async () => {
  let connectionCount = 0;

  await assert.rejects(
    recordAutomaticTicketDecision(
      {
        ticketId: "abc",
        status: "approved",
      },
      async () => {
        connectionCount++;
        return createDecisionClientMock().client;
      },
    ),
    /identificador del ticket es inválido/,
  );

  assert.equal(connectionCount, 0);
});

test("Rechaza estados inválidos sin abrir conexión", async () => {
  let connectionCount = 0;

  await assert.rejects(
    recordAutomaticTicketDecision(
      {
        ticketId: "100",
        status: "processing" as "approved",
      },
      async () => {
        connectionCount++;
        return createDecisionClientMock().client;
      },
    ),
    /estado de validación es inválido/,
  );

  assert.equal(connectionCount, 0);
});

test("No expone información interna en el historial", async () => {
  const mockQuery: ListParticipantTicketsQuery =
    async () => ({
      rows: [
        {
          id: "100",
          original_filename: "ticket.png",
          mime_type: "image/png",
          status: "rejected",
          created_at: createdAt,
          merchant_name: "Chedraui",
          purchase_date: "2026-11-18",
          total_amount: "250.00",
          currency: "MXN",
          rejection_reason:
            "El archivo ya fue registrado en el ticket 99.",
          veryfi_document_id: 12345,
          file_hash: "a".repeat(64),
          file_path: "private/ticket.png",
          ocr_data: {
            internal: true,
          },
        },
      ],
    });

  const tickets = await listParticipantTickets(
    "15",
    mockQuery,
  );

  assert.deepEqual(tickets, [
    {
      id: "100",
      originalFilename: "ticket.png",
      mimeType: "image/png",
      status: "rejected",
      createdAt,
      merchantName: "Chedraui",
      purchaseDate: "2026-11-18",
      totalAmount: 250,
      currency: "MXN",
      statusMessage:
        "Tu comprobante no cumple con las reglas de participación.",
    },
  ]);
});
