
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { pool } from "../../database/connection.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  createParticipant,
  findParticipantByEmail,
} from "./participants.repository.js";

async function main(): Promise<void> {
  const email = `test-${randomUUID()}@example.com`;

  try {
    const password = "ClaveDePrueba123!";
    const passwordHash = await hashPassword(password);

    const participant = await createParticipant({
      full_name: "Participante de prueba",
      email,
      password_hash: passwordHash,
    });

    console.log("Participante temporal creado:", participant.id);

    const found = await findParticipantByEmail(
      email.toUpperCase(),
    );

    if (!found || found.id !== participant.id) {
      throw new Error(
        "No fue posible consultar al participante registrado.",
      );
    }

    if (!(await verifyPassword(password, found.password_hash))) {
      throw new Error(
        "No fue posible verificar la contraseña.",
      );
    }

    console.log("Consulta y contraseña: correctas.");

    try {
      await createParticipant({
        full_name: "Participante duplicado",
        email: email.toUpperCase(),
        password_hash: passwordHash,
      });

      throw new Error(
        "PostgreSQL permitió registrar un correo duplicado.",
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        console.log("Correo duplicado rechazado correctamente.");
      } else {
        throw error;
      }
    }
  } finally {
    try {
      await pool.query(
        "DELETE FROM participants WHERE email = $1",
        [email],
      );

      console.log("Limpieza del participante temporal completada.");
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error("Error en la prueba de participantes:", error);
  process.exitCode = 1;
});
