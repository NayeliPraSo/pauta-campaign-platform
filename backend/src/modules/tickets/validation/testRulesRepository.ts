
import "dotenv/config";

import { pool } from "../../../database/connection";
import { getActiveValidationRules } from "./rulesRepository";

async function main(): Promise<void> {
  try {
    const rules = await getActiveValidationRules();

    console.log("Conexión con PostgreSQL exitosa.");
    console.log("Reglas activas encontradas:", rules.length);
    console.log("Reglas:", JSON.stringify(rules, null, 2));
  } catch (error) {
    console.error("Error al consultar las reglas:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
