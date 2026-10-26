
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";

import {
  findParticipantById,
} from "./participants.repository.js";

test("Busca un participante activo mediante una consulta parametrizada", async () => {
  const participant = {
    id: "18",
    full_name: "Participante de Prueba",
    email: "participante.prueba@example.com",
  };

  let executedQuery = "";
  let queryParams: unknown[] = [];

  const fakeClient = {
    query: async (query: string, params: unknown[]) => {
      executedQuery = query;
      queryParams = params;

      return {
        rows: [participant],
      };
    },
  } as unknown as Pool;

  const result = await findParticipantById("18", fakeClient);

  assert.deepEqual(result, participant);
  assert.deepEqual(queryParams, ["18"]);
  assert.match(executedQuery, /WHERE\s+id\s*=\s*\$1/i);
  assert.match(executedQuery, /is_active\s*=\s*TRUE/i);
});

test("No selecciona el hash de la contraseña", async () => {
  let executedQuery = "";

  const fakeClient = {
    query: async (query: string) => {
      executedQuery = query;

      return {
        rows: [],
      };
    },
  } as unknown as Pool;

  await findParticipantById("18", fakeClient);

  assert.doesNotMatch(executedQuery, /password_hash/i);
});

test("Devuelve null cuando el participante no existe", async () => {
  const fakeClient = {
    query: async () => ({
      rows: [],
    }),
  } as unknown as Pool;

  const result = await findParticipantById("999", fakeClient);

  assert.equal(result, null);
});

test("Propaga los errores de PostgreSQL", async () => {
  const fakeClient = {
    query: async () => {
      throw new Error("Error de PostgreSQL");
    },
  } as unknown as Pool;

  await assert.rejects(
    () => findParticipantById("18", fakeClient),
    /Error de PostgreSQL/,
  );
});
