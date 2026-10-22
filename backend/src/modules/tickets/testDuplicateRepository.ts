
import "dotenv/config";

import { pool } from "../../database/connection";
import { findTicketByFileHash } from "./duplicateRepository";
import { calculateBufferHash } from "./utils/fileHash";

async function main(): Promise<void> {
  const fileHash = calculateBufferHash(
    Buffer.from("Ticket de prueba para duplicados"),
  );

  console.log("Hash de prueba:", fileHash);

  const existingTicket = await findTicketByFileHash(fileHash);

  if (existingTicket) {
    console.log("Ticket duplicado encontrado:", existingTicket);
  } else {
    console.log("No existe un ticket con este hash.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Error al consultar duplicados:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
