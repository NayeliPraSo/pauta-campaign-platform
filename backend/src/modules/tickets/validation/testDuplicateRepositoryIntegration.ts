
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../../database/connection";
import { calculateBufferHash } from "../utils/fileHash";
import { getActiveValidationRules } from "./rulesRepository";
import { validateTicketWithDatabase } from "./validateTicketWithDatabase";

async function main(): Promise<void> {
  const rules = await getActiveValidationRules();

  assert.ok(
    rules.some(
      (rule) =>
        rule.rule_type === "duplicate_ticket" &&
        rule.is_enabled,
    ),
    "La regla duplicate_ticket debe estar activa.",
  );

  const testId = randomUUID();
  const email = `duplicado-${testId}@example.invalid`;
  const fileHash = calculateBufferHash(
    Buffer.from(`ticket-integracion:${testId}`),
  );

  let participantId: string | undefined;

  try {
    const participant = await pool.query<{ id: string }>(
      `INSERT INTO participants (
        full_name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING id::text AS id`,
      [
        "Participante de integración",
        email,
        "NO_VALID_PASSWORD_HASH_TEST_ONLY",
      ],
    );

    participantId = participant.rows[0]?.id;
    assert.ok(participantId);

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO tickets (
        participant_id,
        original_filename,
        file_path,
        mime_type,
        status,
        file_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id::text AS id`,
      [
        participantId,
        "ticket-integracion.png",
        `/tmp/ticket-integracion-${testId}.png`,
        "image/png",
        "rejected",
        fileHash,
      ],
    );

    const existingTicketId = inserted.rows[0]?.id;
    assert.ok(existingTicketId);

    console.log("Ticket registrado:", existingTicketId);

    // Sin tercer argumento: utiliza el repositorio real.
    const result = await validateTicketWithDatabase(
      {
        file_hash: fileHash,
        merchant_name: "Walmart",
        total_amount: 200,
        currency: "MXN",
        products: [
          {
            description: "Coca-Cola 600 ml",
            quantity: 1,
          },
        ],
      },
      rules,
    );

    console.log("Resultado:", result.status);

    for (const item of result.results) {
      console.log(`${item.rule_type}: ${item.passed}`);
    }

    assert.equal(result.status, "rejected");

    const duplicateResult = result.results.find(
      (item) => item.rule_type === "duplicate_ticket",
    );

    assert.equal(duplicateResult?.passed, false);
    assert.match(
      duplicateResult.reason ?? "",
      new RegExp(`\\b${existingTicketId}\\b`),
    );

    console.log("Integración con repositorio real: correcta.");
  } finally {
    try {
      // Eliminar únicamente los registros creados por esta prueba.
      await pool.query(
        `DELETE FROM tickets WHERE file_hash = $1`,
        [fileHash],
      );
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
