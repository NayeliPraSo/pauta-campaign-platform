
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const email = `duplicado-${randomUUID()}@example.invalid`;

    const participant = await client.query<{ id: string }>(
      `INSERT INTO participants (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id::text AS id`,
      [
        "Participante temporal",
        email,
        "NO_VALID_PASSWORD_HASH_TEST_ONLY",
      ],
    );

    const participantId = participant.rows[0]?.id;

    assert.ok(participantId);

    const fileHash = calculateBufferHash(
      Buffer.from(`ticket-duplicado:${randomUUID()}`),
    );

    const inserted = await client.query<{ id: string }>(
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
        "ticket-prueba.png",
        "/tmp/ticket-prueba.png",
        "image/png",
        "rejected",
        fileHash,
      ],
    );

    const existingTicketId = inserted.rows[0]?.id;

    assert.ok(existingTicketId);

    console.log("Ticket rechazado registrado:", existingTicketId);

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
      async (hash) => {
        const duplicate = await client.query<{
          id: string;
          status: string;
        }>(
          `SELECT id::text AS id, status
           FROM tickets
           WHERE file_hash = $1
           LIMIT 1`,
          [hash],
        );

        return duplicate.rows[0] ?? null;
      },
    );

    console.log("Resultado:", result.status);

    for (const ruleResult of result.results) {
      console.log(
        `${ruleResult.rule_type}: ${ruleResult.passed}`,
      );
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

    console.log("Prueba de duplicado real: correcta.");
  } finally {
    try {
      await client.query("ROLLBACK");
      console.log("Transacción revertida.");
    } finally {
      client.release();
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
