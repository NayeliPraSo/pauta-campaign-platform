
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { checkDatabaseConnection, pool } from "./database/connection.js";

const app = express();

const PORT = Number(process.env.PORT ?? 3000);

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:4321",
  })
);

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      success: true,
      message: "Pauta Campaign Platform API",
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Error de conexión a PostgreSQL:", error);

    res.status(503).json({
      success: false,
      message: "Servicio temporalmente no disponible",
      status: "error",
      database: "disconnected",
    });
  }
});

async function startServer(): Promise<void> {
  try {
    await checkDatabaseConnection();

    app.listen(PORT, () => {
      console.log(`API disponible en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("No fue posible iniciar el servidor:", error);
    process.exitCode = 1;
    await pool.end();
  }
}

void startServer();
