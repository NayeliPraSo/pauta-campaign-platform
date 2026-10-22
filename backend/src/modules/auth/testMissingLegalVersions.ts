
import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection.js";
import { registerParticipant } from "./auth.service.js";

async function main(): Promise<void> {
  const email = `missing-legal-${randomUUID()}@example.com`;

  const originalTermsVersion = process.env.TERMS_VERSION;
  const originalPrivacyVersion = process.env.PRIVACY_VERSION;

  try {
    delete process.env.TERMS_VERSION;
    delete process.env.PRIVACY_VERSION;

    await assert.rejects(
      registerParticipant({
        full_name: "Prueba sin versiones legales",
        email,
        password: "ClaveSegura123!",
        accepted_terms: true,
        accepted_privacy: true,
      }),
      {
        message:
          "Las versiones de los documentos legales no están configuradas correctamente.",
      },
    );

    console.log(
      "Registro rechazado correctamente por falta de versiones legales.",
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
      "No debe crearse un participante sin versiones legales.",
    );

    console.log(
      "Verificado: no se creó ningún participante.",
    );

    console.log(
      "Prueba de configuración legal completada.",
    );
  } finally {
    if (originalTermsVersion === undefined) {
      delete process.env.TERMS_VERSION;
    } else {
      process.env.TERMS_VERSION = originalTermsVersion;
    }

    if (originalPrivacyVersion === undefined) {
      delete process.env.PRIVACY_VERSION;
    } else {
      process.env.PRIVACY_VERSION = originalPrivacyVersion;
    }

    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Error en la prueba de configuración legal:",
    error,
  );

  process.exitCode = 1;
});
