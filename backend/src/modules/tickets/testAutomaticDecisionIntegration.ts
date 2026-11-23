
import "dotenv/config";
import assert from "node:assert/strict";

import { pool } from "../../database/connection.js";
import {
  recordAutomaticTicketDecision,
  type TicketDecisionClient,
} from "./tickets.repository.js";

async function main(): Promise<void> {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const participant = await client.query<{ id: string }>(
      "SELECT id::text AS id FROM participants ORDER BY id LIMIT 1",
    );

    const participantId = participant.rows[0]?.id;

    if (!participantId) {
      throw new Error(
        "No existe un participante para realizar la prueba.",
      );
    }

    const created = await client.query<{ id: string }>(
      `
        INSERT INTO tickets (
          participant_id,
          original_filename,
          file_path,
          mime_type,
          status
        )
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id::text AS id
      `,
      [
        participantId,
        "automatic-decision-test.png",
        "integration-test/automatic-decision-test.png",
        "image/png",
      ],
    );

    const ticketId = created.rows[0]?.id;

    assert.ok(ticketId, "No se creó el ticket temporal.");

    const testClient: TicketDecisionClient = {
      async query(sql, values) {
        const command = sql.trim().toUpperCase();

        // La transacción externa controla la confirmación final.
        if (command === "BEGIN" || command === "COMMIT") {
          return { rows: [] };
        }

        return client.query(sql, values ? [...values] : []);
      },
      release() {
        // La conexión pertenece a esta prueba.
      },
    };

    await recordAutomaticTicketDecision(
      {
        ticketId,
        status: "rejected",
        reason: "Prueba de integración reversible.",
        metadata: {
          source: "integration_test",
        },
      },
      async () => testClient,
    );

    const ticket = await client.query<{
      status: string;
      rejection_reason: string | null;
      reviewed_at: Date | null;
    }>(
      `
        SELECT status, rejection_reason, reviewed_at
        FROM tickets
        WHERE id = $1
      `,
      [ticketId],
    );

    assert.equal(ticket.rows[0]?.status, "rejected");
    assert.equal(
      ticket.rows[0]?.rejection_reason,
      "Prueba de integración reversible.",
    );
    assert.ok(ticket.rows[0]?.reviewed_at);

    const reviews = await client.query<{
      previous_status: string;
      new_status: string;
      review_type: string;
      reason: string | null;
      metadata: Record<string, unknown>;
    }>(
      `
        SELECT
          previous_status,
          new_status,
          review_type,
          reason,
          metadata
        FROM ticket_reviews
        WHERE ticket_id = $1
      `,
      [ticketId],
    );

    assert.equal(reviews.rows.length, 1);
    assert.equal(reviews.rows[0]?.previous_status, "pending");
    assert.equal(reviews.rows[0]?.new_status, "rejected");
    assert.equal(reviews.rows[0]?.review_type, "automatic");
    assert.equal(
      reviews.rows[0]?.reason,
      "Prueba de integración reversible.",
    );
    assert.deepEqual(reviews.rows[0]?.metadata, {
      source: "integration_test",
    });

    console.log("Decisión automática y auditoría verificadas.");
    console.log("Ticket temporal:", ticketId);
  } finally {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
        console.log("ROLLBACK de prueba ejecutado.");
      } catch (error) {
        console.error("No fue posible revertir la prueba:", error);
        throw error;
      }
    }

    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Falló la prueba de integración:", error);
  process.exitCode = 1;
});
