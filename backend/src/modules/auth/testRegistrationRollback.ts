
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection.js";
import { createParticipant } from "./participants.repository.js";
import { createParticipantConsent } from "./consents.repository.js";
import { hashPassword } from "./password.js";

async function main(): Promise<void> {
  const email = `rollback-${randomUUID()}@example.com`;
  const client = await pool.connect();

  let transactionStarted = false;
  let rollbackCompleted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const participant = await createParticipant(
      {
        full_name: "Prueba de rollback",
        email,
        password_hash: await hashPassword("ClaveSegura123!"),
      },
      client,
    );

    console.log("Participante creado dentro de la transacción.");

    try {
      await createParticipantConsent(client, {
        participant_id: participant.id,
        terms_version: "X".repeat(51),
        privacy_version: "test-1.0",
      });

      assert.fail(
        "Se esperaba un error al registrar el consentimiento.",
      );
    } catch (error) {
      // PostgreSQL debe rechazar una versión de más de 50 caracteres.
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "22001"
      ) {
        throw error;
      }

      console.log("Error de consentimiento provocado correctamente.");
    }

    await client.query("ROLLBACK");
    transactionStarted = false;
    rollbackCompleted = true;

    console.log("ROLLBACK ejecutado correctamente.");

    const result = await client.query<{ id: string }>(
      `
        SELECT id::text AS id
        FROM participants
        WHERE email = $1
      `,
      [email],
    );

    assert.equal(result.rows.length, 0);

    console.log("Verificado: el participante no quedó registrado.");
    console.log("Prueba de rollback completada.");
  } finally {
    try {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
    } finally {
      client.release();

      // Limpieza defensiva por si la prueba falló después de COMMIT.
      if (!rollbackCompleted) {
        await pool.query(
          `
            DELETE FROM participant_consents
            WHERE participant_id IN (
              SELECT id FROM participants WHERE email = $1
            )
          `,
          [email],
        );

        await pool.query(
          "DELETE FROM participants WHERE email = $1",
          [email],
        );
      }

      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error("Error en la prueba de rollback:", error);
  process.exitCode = 1;
});
