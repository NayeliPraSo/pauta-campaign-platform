
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { pool } from "../../database/connection";
import { calculateBufferHash } from "./utils/fileHash";

async function main(): Promise<void> {
  const client = await pool.connect();

  const fileHash = calculateBufferHash(
    Buffer.from("Ticket duplicado de prueba"),
  );

  try {
    await client.query("BEGIN");

    // 1. Crear un participante temporal.
    const participantResult = await client.query<{ id: string }>(
      `
        INSERT INTO participants (
          full_name,
          email,
          password_hash
        )
        VALUES ($1, $2, $3)
        RETURNING id::text AS id
      `,
      [
        "Participante de prueba",
        `prueba-${randomUUID()}@example.invalid`,
        "NO_VALID_PASSWORD_HASH_TEST_ONLY",
      ],
    );

    const participantId = participantResult.rows[0]?.id;

    if (!participantId) {
      throw new Error("No se pudo crear el participante temporal.");
    }

    console.log("Participante temporal:", participantId);

    // 2. Crear un ticket previamente rechazado.
    const ticketResult = await client.query<{ id: string }>(
      `
        INSERT INTO tickets (
          participant_id,
          original_filename,
          file_path,
          mime_type,
          file_hash,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id::text AS id
      `,
      [
        participantId,
        "ticket-prueba.png",
        "/tmp/ticket-prueba.png",
        "image/png",
        fileHash,
        "rejected",
      ],
    );

    const ticketId = ticketResult.rows[0]?.id;

    console.log("Ticket temporal:", ticketId);

    // 3. Buscar el duplicado dentro de la transacción.
    const duplicateResult = await client.query<{
      id: string;
      status: string;
    }>(
      `
        SELECT id::text AS id, status
        FROM tickets
        WHERE file_hash = $1
        LIMIT 1
      `,
      [fileHash],
    );

    const duplicate = duplicateResult.rows[0] ?? null;

    console.log("Duplicado encontrado:", duplicate);

    if (!duplicate || duplicate.status !== "rejected") {
      throw new Error(
        "No se identificó correctamente el ticket rechazado.",
      );
    }

    // 4. Comprobar que el índice único impide repetir el hash.
    await client.query("SAVEPOINT duplicate_test");

    try {
      await client.query(
        `
          INSERT INTO tickets (
            participant_id,
            original_filename,
            file_path,
            mime_type,
            file_hash,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          participantId,
          "ticket-repetido.png",
          "/tmp/ticket-repetido.png",
          "image/png",
          fileHash,
          "pending",
        ],
      );

      throw new Error(
        "ERROR: PostgreSQL permitió insertar un hash duplicado.",
      );
    } catch (error: unknown) {
      const databaseError = error as { code?: string };

      if (databaseError.code !== "23505") {
        throw error;
      }

      console.log(
        "Índice único: duplicado bloqueado correctamente (23505).",
      );
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT duplicate_test");
    }

    console.log("Pruebas completadas correctamente.");
  } finally {
    try {
      await client.query("ROLLBACK");
      console.log("Transacción revertida.");
    } finally {
      client.release();
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error("Error durante la prueba:", error);
  process.exitCode = 1;
});
