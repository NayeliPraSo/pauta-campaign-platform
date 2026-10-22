
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection";
import { calculateBufferHash } from "./utils/fileHash";
import { findTicketByPurchaseData } from "./duplicateRepository";

async function main(): Promise<void> {
  const client = await pool.connect();

  const testId = randomUUID();
  const ticketNumber = `TEST-${testId}`;
  const fileHash = calculateBufferHash(
    Buffer.from(`purchase-duplicate:${testId}`),
  );

  let participantId: string | undefined;

  try {
    // Creamos un participante temporal.
    const participant = await client.query<{ id: string }>(
      `INSERT INTO participants (
        full_name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING id::text AS id`,
      [
        "Participante temporal",
        `purchase-${testId}@example.invalid`,
        "NO_VALID_PASSWORD_HASH_TEST_ONLY",
      ],
    );

    participantId = participant.rows[0]?.id;
    assert.ok(participantId);

    // Registramos un ticket de prueba.
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO tickets (
        participant_id,
        original_filename,
        file_path,
        mime_type,
        status,
        file_hash,
        ticket_number,
        merchant_name,
        purchase_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id::text AS id`,
      [
        participantId,
        "ticket-prueba.png",
        `/tmp/purchase-${testId}.png`,
        "image/png",
        "rejected",
        fileHash,
        ticketNumber,
        "Walmart",
        "2026-10-21",
      ],
    );

    const ticketId = inserted.rows[0]?.id;
    assert.ok(ticketId);

    console.log("Ticket temporal:", ticketId);

    const scenarios = [
      {
        name: "Mismo número, comercio y fecha",
        data: {
          ticket_number: ticketNumber,
          merchant_name: "Walmart",
          purchase_date: "2026-10-21",
        },
        expectedMatch: true,
      },
      {
        name: "Comercio con diferente capitalización",
        data: {
          ticket_number: ticketNumber,
          merchant_name: "walmart",
          purchase_date: "2026-10-21",
        },
        expectedMatch: true,
      },
      {
        name: "Número de ticket diferente",
        data: {
          ticket_number: `OTRO-${testId}`,
          merchant_name: "Walmart",
          purchase_date: "2026-10-21",
        },
        expectedMatch: false,
      },
      {
        name: "Fecha diferente",
        data: {
          ticket_number: ticketNumber,
          merchant_name: "Walmart",
          purchase_date: "2026-10-20",
        },
        expectedMatch: false,
      },
      {
        name: "Comercio diferente",
        data: {
          ticket_number: ticketNumber,
          merchant_name: "Soriana",
          purchase_date: "2026-10-21",
        },
        expectedMatch: false,
      },
    ];

    for (const scenario of scenarios) {
      const result = await findTicketByPurchaseData(
        scenario.data,
      );

      assert.equal(
        result !== null,
        scenario.expectedMatch,
        scenario.name,
      );

      if (scenario.expectedMatch) {
        assert.equal(result?.id, ticketId);
      }

      console.log(
        `${scenario.name}: ${
          result ? "coincidencia" : "sin coincidencia"
        }`,
      );
    }

    console.log("Todas las comprobaciones fueron correctas.");
  } finally {
    try {
      await client.query(
        "DELETE FROM tickets WHERE file_hash = $1",
        [fileHash],
      );
    } finally {
      if (participantId) {
        await client.query(
          "DELETE FROM participants WHERE id = $1",
          [participantId],
        );
      }

      client.release();
      console.log("Registros temporales eliminados.");
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("Error en la prueba:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
