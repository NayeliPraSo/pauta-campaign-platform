
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection";
import { findTicketByVeryfiDocumentId } from "./duplicateRepository";

async function main(): Promise<void> {
  const testId = randomUUID();
  const email = `veryfi-duplicado-${testId}@example.invalid`;

  // ID del primer documento real que analizamos.
  const veryfiDocumentId = 515771049;

  let participantId: string | undefined;
  let ticketId: string | undefined;

  try {
    // Verificar que el documento no esté registrado previamente.
    const existing = await findTicketByVeryfiDocumentId(
      veryfiDocumentId,
    );

    assert.equal(
      existing,
      null,
      "El documento Veryfi ya existe en la base de datos.",
    );

    // Crear participante temporal.
    const participant = await pool.query<{ id: string }>(
      `INSERT INTO participants (
        full_name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING id::text AS id`,
      [
        "Participante Veryfi integración",
        email,
        "NO_VALID_PASSWORD_HASH_TEST_ONLY",
      ],
    );

    participantId = participant.rows[0]?.id;
    assert.ok(participantId);

    // Registrar ticket con el ID real de Veryfi.
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO tickets (
        participant_id,
        original_filename,
        file_path,
        mime_type,
        status,
        veryfi_document_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id::text AS id`,
      [
        participantId,
        "ticket-veryfi-integracion.png",
        `/tmp/ticket-veryfi-${testId}.png`,
        "image/png",
        "rejected",
        veryfiDocumentId,
      ],
    );

    ticketId = inserted.rows[0]?.id;
    assert.ok(ticketId);

    console.log("Ticket registrado:", ticketId);
    console.log("Documento Veryfi:", veryfiDocumentId);

    // Buscar mediante el repositorio real.
    const result = await findTicketByVeryfiDocumentId(
      veryfiDocumentId,
    );

    assert.ok(result);
    assert.equal(result.id, ticketId);
    assert.equal(result.status, "rejected");

    console.log("Ticket encontrado:", result.id);
    console.log("Estado:", result.status);
    console.log("Integración con Veryfi: correcta.");
  } finally {
    try {
      // Eliminar solamente el ticket creado por esta prueba.
      if (ticketId) {
        await pool.query(
          `DELETE FROM tickets WHERE id = $1`,
          [ticketId],
        );
      }
    } finally {
      if (participantId) {
        await pool.query(
          `DELETE FROM participants WHERE id = $1`,
          [participantId],
        );
      }

      console.log("Registros temporales eliminados.");
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("Error en la integración:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
