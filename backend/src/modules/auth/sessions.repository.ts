
import { pool } from "../../database/connection.js";
import type { Pool, PoolClient } from "pg";

export interface CreateParticipantSessionInput {
  participantId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ParticipantSession {
  id: string;
  participant_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export async function createParticipantSession(
  input: CreateParticipantSessionInput,
  client: Pool | PoolClient = pool,
): Promise<ParticipantSession> {
  const result = await client.query<ParticipantSession>(
    `
      INSERT INTO participant_sessions (
        participant_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
      RETURNING
        id::text AS id,
        participant_id::text AS participant_id,
        token_hash,
        created_at,
        expires_at,
        revoked_at
    `,
    [
      input.participantId,
      input.tokenHash,
      input.expiresAt,
    ],
  );

  const session = result.rows[0];

  if (!session) {
    throw new Error("No fue posible crear la sesión del participante.");
  }

  return session;
}



export async function findActiveParticipantSessionByTokenHash(
  tokenHash: string,
  client: Pool | PoolClient = pool,
): Promise<ParticipantSession | null> {
  const result = await client.query<ParticipantSession>(
    `
      SELECT
        s.id::text AS id,
        s.participant_id::text AS participant_id,
        s.token_hash,
        s.created_at,
        s.expires_at,
        s.revoked_at
      FROM participant_sessions AS s
      INNER JOIN participants AS p
        ON p.id = s.participant_id
      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
        AND s.revoked_at IS NULL
        AND p.is_active = TRUE
      LIMIT 1
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}


export async function revokeParticipantSessionByTokenHash(
  tokenHash: string,
  client: Pool | PoolClient = pool,
): Promise<boolean> {
  const result = await client.query(
    `
      UPDATE participant_sessions
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `,
    [tokenHash],
  );

  return (result.rowCount ?? 0) > 0;
}
