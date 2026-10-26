
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";

import {
  createParticipantSession,
  findActiveParticipantSessionByTokenHash,
  revokeParticipantSessionByTokenHash,
  type ParticipantSession,
} from "./sessions.repository.js";

test("Crea una sesión utilizando una consulta parametrizada", async () => {
  const expiresAt = new Date("2026-11-01T12:00:00.000Z");

  const session: ParticipantSession = {
    id: "1",
    participant_id: "17",
    token_hash: "a".repeat(64),
    created_at: new Date("2026-10-23T12:00:00.000Z"),
    expires_at: expiresAt,
    revoked_at: null,
  };

  let capturedQuery = "";
  let capturedValues: unknown[] = [];

  const mockClient = {
    query: async (sql: string, values: unknown[]) => {
      capturedQuery = sql;
      capturedValues = values;

      return { rows: [session] };
    },
  } as unknown as PoolClient;

  const result = await createParticipantSession(
    {
      participantId: "17",
      tokenHash: "a".repeat(64),
      expiresAt,
    },
    mockClient,
  );

  assert.deepEqual(result, session);

  assert.match(capturedQuery, /INSERT INTO participant_sessions/);
  assert.match(capturedQuery, /VALUES \(\$1, \$2, \$3\)/);
  assert.match(capturedQuery, /id::text AS id/);
  assert.match(capturedQuery, /participant_id::text AS participant_id/);

  assert.deepEqual(capturedValues, [
    "17",
    "a".repeat(64),
    expiresAt,
  ]);
});

test("Genera un error cuando PostgreSQL no devuelve la sesión", async () => {
  const mockClient = {
    query: async () => ({ rows: [] }),
  } as unknown as PoolClient;

  await assert.rejects(
    () =>
      createParticipantSession(
        {
          participantId: "17",
          tokenHash: "b".repeat(64),
          expiresAt: new Date("2026-11-01T12:00:00.000Z"),
        },
        mockClient,
      ),
    {
      message: "No fue posible crear la sesión del participante.",
    },
  );
});


test("Busca una sesión activa utilizando el hash del token", async () => {
  const tokenHash = "c".repeat(64);

  const session: ParticipantSession = {
    id: "25",
    participant_id: "17",
    token_hash: tokenHash,
    created_at: new Date("2026-10-23T12:00:00.000Z"),
    expires_at: new Date("2026-10-24T00:00:00.000Z"),
    revoked_at: null,
  };

  let capturedQuery = "";
  let capturedValues: unknown[] = [];

  const mockClient = {
    query: async (sql: string, values: unknown[]) => {
      capturedQuery = sql;
      capturedValues = values;

      return { rows: [session] };
    },
  } as unknown as PoolClient;

  const result = await findActiveParticipantSessionByTokenHash(
    tokenHash,
    mockClient,
  );

  assert.deepEqual(result, session);

  // Verificar que consulta la tabla de sesiones.
  assert.match(
    capturedQuery,
    /FROM\s+participant_sessions\s+AS\s+s/i,
  );

  // Verificar que relaciona la sesión con el participante.
  assert.match(
    capturedQuery,
    /INNER\s+JOIN\s+participants\s+AS\s+p/i,
  );

  assert.match(
    capturedQuery,
    /ON\s+p\.id\s*=\s*s\.participant_id/i,
  );

  // Verificar que utiliza el hash del token.
  assert.match(
    capturedQuery,
    /s\.token_hash\s*=\s*\$1/i,
  );

  // Verificar que la sesión no haya expirado.
  assert.match(
    capturedQuery,
    /s\.expires_at\s*>\s*NOW\(\)/i,
  );

  // Verificar que la sesión no esté revocada.
  assert.match(
    capturedQuery,
    /s\.revoked_at\s+IS\s+NULL/i,
  );

  // Verificar que el participante continúe activo.
  assert.match(
    capturedQuery,
    /p\.is_active\s*=\s*TRUE/i,
  );

  // Verificar que la consulta esté parametrizada.
  assert.deepEqual(capturedValues, [tokenHash]);
});

test("Devuelve null cuando no encuentra una sesión activa", async () => {
  const mockClient = {
    query: async () => ({ rows: [] }),
  } as unknown as PoolClient;

  const result = await findActiveParticipantSessionByTokenHash(
    "d".repeat(64),
    mockClient,
  );

  assert.equal(result, null);
});

test("Propaga los errores de PostgreSQL al consultar una sesión", async () => {
  const mockClient = {
    query: async () => {
      throw new Error("Error al consultar PostgreSQL.");
    },
  } as unknown as PoolClient;

  await assert.rejects(
    () =>
      findActiveParticipantSessionByTokenHash(
        "e".repeat(64),
        mockClient,
      ),
    {
      message: "Error al consultar PostgreSQL.",
    },
  );
});


test("Revoca una sesión activa utilizando el hash del token", async () => {
  const tokenHash = "f".repeat(64);

  let capturedQuery = "";
  let capturedValues: unknown[] = [];

  const mockClient = {
    query: async (sql: string, values: unknown[]) => {
      capturedQuery = sql;
      capturedValues = values;

      return { rowCount: 1 };
    },
  } as unknown as PoolClient;

  const result = await revokeParticipantSessionByTokenHash(
    tokenHash,
    mockClient,
  );

  assert.equal(result, true);

  assert.match(capturedQuery, /UPDATE participant_sessions/);
  assert.match(capturedQuery, /SET revoked_at = NOW\(\)/);
  assert.match(capturedQuery, /token_hash = \$1/);
  assert.match(capturedQuery, /revoked_at IS NULL/);
  assert.match(capturedQuery, /expires_at > NOW\(\)/);

  assert.deepEqual(capturedValues, [tokenHash]);
});

test("Devuelve false cuando no encuentra una sesión activa para revocar", async () => {
  const mockClient = {
    query: async () => ({
      rowCount: 0,
    }),
  } as unknown as PoolClient;

  const result = await revokeParticipantSessionByTokenHash(
    "a".repeat(64),
    mockClient,
  );

  assert.equal(result, false);
});

test("Propaga los errores de PostgreSQL al revocar una sesión", async () => {
  const mockClient = {
    query: async () => {
      throw new Error("Error al revocar la sesión.");
    },
  } as unknown as PoolClient;

  await assert.rejects(
    () =>
      revokeParticipantSessionByTokenHash(
        "b".repeat(64),
        mockClient,
      ),
    {
      message: "Error al revocar la sesión.",
    },
  );
});
