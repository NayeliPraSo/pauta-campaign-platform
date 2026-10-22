
import "dotenv/config";
process.env.TERMS_VERSION = "test-1.0";
process.env.PRIVACY_VERSION = "test-1.0";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection.js";
import { registerParticipant } from "./auth.service.js";
import { verifyPassword } from "./password.js";

async function main(): Promise<void> {
  const email = `test-${randomUUID()}@example.com`;
  let participantId: string | null = null;

  try {
    const participant = await registerParticipant({
      full_name: "Participante de integración",
      email,
      password: "ClaveSegura123!",
      accepted_terms: true,
      accepted_privacy: true,
    });

    participantId = participant.id;

    console.log("Participante registrado:", participant.id);

    const participantResult = await pool.query<{
      id: string;
      password_hash: string;
    }>(
      `
        SELECT
          id::text AS id,
          password_hash
        FROM participants
        WHERE id = $1
      `,
      [participantId],
    );

    assert.equal(participantResult.rows.length, 1);

    const passwordValid = await verifyPassword(
      "ClaveSegura123!",
      participantResult.rows[0]!.password_hash,
    );

    assert.equal(passwordValid, true);

    console.log("Contraseña verificada correctamente.");

    const consentResult = await pool.query<{
      participant_id: string;
      terms_version: string;
      privacy_version: string;
    }>(
      `
        SELECT
          participant_id::text AS participant_id,
          terms_version,
          privacy_version
        FROM participant_consents
        WHERE participant_id = $1
      `,
      [participantId],
    );

    assert.equal(consentResult.rows.length, 1);

    const consent = consentResult.rows[0]!;

    assert.equal(consent.participant_id, participantId);
    assert.equal(consent.terms_version, "test-1.0");
    assert.equal(consent.privacy_version, "test-1.0");

    console.log("Consentimiento registrado correctamente.");
    console.log("Prueba de integración completada.");
  } finally {
    if (participantId !== null) {
      await pool.query(
        `
          DELETE FROM participant_consents
          WHERE participant_id = $1
        `,
        [participantId],
      );

      await pool.query(
        `
          DELETE FROM participants
          WHERE id = $1
        `,
        [participantId],
      );

      console.log("Registros temporales eliminados.");
    }

    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Error en la prueba de integración:", error);
  process.exitCode = 1;
});
