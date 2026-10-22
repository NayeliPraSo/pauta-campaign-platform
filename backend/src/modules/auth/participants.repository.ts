
import { pool } from "../../database/connection.js";
import type { Pool, PoolClient } from "pg";

export interface Participant {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
}

export interface CreateParticipantData {
  full_name: string;
  email: string;
  password_hash: string;
}

export async function findParticipantByEmail(
  email: string,
): Promise<Participant | null> {
  const result = await pool.query<Participant>(
    `
      SELECT
        id::text AS id,
        full_name,
        email,
        password_hash,
        is_active
      FROM participants
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] ?? null;
}


export async function createParticipant(
  data: CreateParticipantData,
  client: Pool | PoolClient = pool,
): Promise<Participant> {
  const result = await client.query<Participant>(
    `
      INSERT INTO participants (
        full_name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING
        id::text AS id,
        full_name,
        email,
        password_hash,
        is_active
    `,
    [
      data.full_name,
      data.email,
      data.password_hash,
    ],
  );

  const participant = result.rows[0];

  if (!participant) {
    throw new Error("No fue posible registrar al participante.");
  }

  return participant;
}

