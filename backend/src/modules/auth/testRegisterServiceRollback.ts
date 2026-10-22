
import "dotenv/config";

process.env.TERMS_VERSION = "test-1.0";
process.env.PRIVACY_VERSION = "test-1.0";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection.js";
import { registerParticipant } from "./auth.service.js";

async function main(): Promise<void> {
  const email = `service-rollback-${randomUUID()}@example.com`;

  let consentCalled = false;
  let participantCreated = false;

  try {
    await assert.rejects(
      registerParticipant(
        {
          full_name: "Prueba de rollback del servicio",
          email,
          password: "ClaveSegura123!",
          accepted_terms: true,
          accepted_privacy: true,
        },
        {
          createConsent: async (client, data) => {
            consentCalled = true;

            const result = await client.query(
              `
                SELECT id
                FROM participants
                WHERE id = $1
              `,
              [data.participant_id],
            );

            assert.equal(result.rows.length, 1);
            participantCreated = true;

            throw new Error("Fallo simulado del consentimiento");
          },
        },
      ),
      {
        message: "Fallo simulado del consentimiento",
      },
    );

    assert.equal(consentCalled, true);
    assert.equal(participantCreated, true);

    console.log(
      "El participante se creó dentro de la transacción.",
    );

    console.log(
      "El fallo simulado del consentimiento fue detectado.",
    );

    const result = await pool.query(
      `
        SELECT id
        FROM participants
        WHERE LOWER(email) = LOWER($1)
      `,
      [email],
    );

    assert.equal(
      result.rows.length,
      0,
      "El participante no debe existir después del rollback.",
    );

    console.log(
      "ROLLBACK verificado: el participante no quedó registrado.",
    );

    console.log(
      "Prueba del servicio completada correctamente.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Error en la prueba de rollback del servicio:",
    error,
  );

  process.exitCode = 1;
});
