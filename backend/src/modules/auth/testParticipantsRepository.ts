
import "dotenv/config";

import { pool } from "../../database/connection.js";
import { findParticipantByEmail } from "./participants.repository.js";

async function main(): Promise<void> {
  try {
    const email = "participante-inexistente@example.com";

    const participant = await findParticipantByEmail(email);

    if (participant !== null) {
      throw new Error(
        "La consulta devolvió un participante inesperado.",
      );
    }

    console.log("Consulta de participantes: correcta.");
    console.log("El correo de prueba no está registrado.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Error al consultar participantes:", error);
  process.exitCode = 1;
});
