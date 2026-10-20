
import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const migrationsDir = path.resolve(process.cwd(), "migrations");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate(): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(20261020)");
    lockAcquired = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations"
    );

    const executed = new Set(result.rows.map((row) => row.version));

    const files = (await readdir(migrationsDir))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`Omitida: ${file}`);
        continue;
      }

      // La tabla de control ya se crea automáticamente.
      if (file === "000_create_schema_migrations.sql") {
        continue;
      }

      const sql = await readFile(
        path.join(migrationsDir, file),
        "utf8"
      );

      console.log(`Ejecutando: ${file}`);

      try {
        await client.query("BEGIN");
        await client.query(sql);

        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );

        await client.query("COMMIT");

        console.log(`Completada: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Migraciones actualizadas correctamente.");
  } finally {
        try {
            if (lockAcquired) {
            await client.query("SELECT pg_advisory_unlock(20261020)");
            }
        } finally {
            client.release();
            await pool.end();
        }
    }
}

migrate().catch((error) => {
  console.error("Error al ejecutar migraciones:", error);
  process.exitCode = 1;
});
