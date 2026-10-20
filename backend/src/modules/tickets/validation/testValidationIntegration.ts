
import "dotenv/config";

import { pool } from "../../../database/connection";
import { getActiveValidationRules } from "./rulesRepository";
import { validateTicket } from "./engine";

import type { TicketData } from "./types";

async function main(): Promise<void> {
  try {
    const rules = await getActiveValidationRules();

    console.log("Reglas activas:", rules.length);

    const tickets: {
      name: string;
      data: TicketData;
    }[] = [
      {
        name: "Ticket válido",
        data: {
          total_amount: 200,
          currency: "MXN",
        },
      },
      {
        name: "Ticket con importe insuficiente",
        data: {
          total_amount: 100,
          currency: "MXN",
        },
      },
      {
        name: "Ticket sin importe",
        data: {
          currency: "MXN",
        },
      },
    ];

    for (const ticket of tickets) {
      const result = validateTicket(ticket.data, rules);

      console.log(`\n${ticket.name}`);
      console.log("Estado:", result.status);
      console.log("Detalle:", JSON.stringify(result.results, null, 2));
    }
  } catch (error) {
    console.error("Error en la integración:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
