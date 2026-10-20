
import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();

  try {
    const result = await client.query<{
      database: string;
      username: string;
    }>(
      `SELECT current_database() AS database,
              current_user AS username`
    );

    console.log("PostgreSQL conectado correctamente");
    console.log("Base de datos:", result.rows[0].database);
    console.log("Usuario:", result.rows[0].username);
  } finally {
    client.release();
  }
}
