
import "dotenv/config";

import { pool } from "../../../database/connection";
import { getActiveValidationRules } from "./rulesRepository";
import { calculateBufferHash } from "../utils/fileHash";
import { validateTicketWithDatabase } from "./validateTicketWithDatabase";

import type { TicketData } from "./types";

async function main(): Promise<void> {
  try {
    const rules = await getActiveValidationRules();

    console.log("Reglas activas:", rules.length);

    
    const tickets = [
      {
        name: "Ticket completamente válido",
        data: {
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
      },
      {
        name: "Comercio y producto con alias",
        data: {
          merchant_name: "Walmart Supercenter",
          total_amount: 250,
          currency: "MXN",
          products: [
            {
              description: "Sprite PET 600",
              quantity: 2,
            },
          ],
        },
      },
      {
        name: "Importe insuficiente",
        data: {
          merchant_name: "Soriana",
          total_amount: 100,
          currency: "MXN",
          products: [
            {
              description: "Coca-Cola 600 ml",
              quantity: 1,
            },
          ],
        },
      },
      {
        name: "Comercio no permitido",
        data: {
          merchant_name: "Oxxo",
          total_amount: 200,
          currency: "MXN",
          products: [
            {
              description: "Coca-Cola 600 ml",
              quantity: 1,
            },
          ],
        },
      },
      {
        name: "Producto no participante",
        data: {
          merchant_name: "Walmart",
          total_amount: 200,
          currency: "MXN",
          products: [
            {
              description: "Agua natural 600 ml",
              quantity: 1,
            },
          ],
        },
      },
      {
        name: "Productos no identificados",
        data: {
          merchant_name: "Walmart",
          total_amount: 200,
          currency: "MXN",
        },
      },
      {
        name: "Comercio no identificado",
        data: {
          total_amount: 200,
          currency: "MXN",
          products: [
            {
              description: "Sprite 600 ml",
              quantity: 1,
            },
          ],
        },
      },
      {
        name: "Incumple las tres condiciones",
        data: {
          merchant_name: "Oxxo",
          total_amount: 100,
          currency: "MXN",
          products: [
            {
              description: "Producto no participante",
              quantity: 1,
            },
          ],
        },
      },
    ];


    for (const ticket of tickets) {
      const fileHash = calculateBufferHash(
        Buffer.from(`archivo-de-prueba:${ticket.name}`, "utf8"),
      );

      const result = await validateTicketWithDatabase(
        {
          ...ticket.data,
          file_hash: fileHash,
        },
        rules,
      );

      console.log(`\n--- ${ticket.name} ---`);
      console.log("Estado:", result.status);

      for (const validation of result.results) {
        console.log(
          `${validation.rule_type}: ${validation.passed}`,
        );
        console.log(`Motivo: ${validation.reason}`);
      }
    }
  } catch (error) {
    console.error("Error en la integración:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
