
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  startParticipantSession,
  validateParticipantSession,
  endParticipantSession,
  type SessionServiceDependencies,
} from "./sessions.service.js";

import type {
  CreateParticipantSessionInput,
  ParticipantSession,
} from "./sessions.repository.js";

const FIXED_DATE = new Date("2026-10-23T12:00:00.000Z");

const EXPECTED_EXPIRATION = new Date(
  "2026-10-24T00:00:00.000Z",
);

const TEST_TOKEN = "a".repeat(64);
const TEST_TOKEN_HASH = "b".repeat(64);

function createMockSession(
  input: CreateParticipantSessionInput,
): ParticipantSession {
  return {
    id: "25",
    participant_id: input.participantId,
    token_hash: input.tokenHash,
    created_at: FIXED_DATE,
    expires_at: input.expiresAt,
    revoked_at: null,
  };
}

test("Crea una sesión con duración de 12 horas", async () => {
  let capturedInput: CreateParticipantSessionInput | undefined;

  const dependencies: SessionServiceDependencies = {
    generateToken: () => TEST_TOKEN,
    hashToken: () => TEST_TOKEN_HASH,
    now: () => FIXED_DATE,

    createSession: async (input) => {
      capturedInput = input;
      return createMockSession(input);
    },
  };

  const result = await startParticipantSession(
    "17",
    dependencies,
  );

  assert.deepEqual(capturedInput, {
    participantId: "17",
    tokenHash: TEST_TOKEN_HASH,
    expiresAt: EXPECTED_EXPIRATION,
  });

  assert.equal(result.token, TEST_TOKEN);
  assert.equal(result.sessionId, "25");
  assert.deepEqual(result.expiresAt, EXPECTED_EXPIRATION);
});

test("Calcula el hash del token antes de guardar la sesión", async () => {
  let tokenReceivedByHash: string | undefined;
  let tokenHashStored: string | undefined;

  await startParticipantSession("17", {
    generateToken: () => TEST_TOKEN,

    hashToken: (token) => {
      tokenReceivedByHash = token;
      return TEST_TOKEN_HASH;
    },

    now: () => FIXED_DATE,

    createSession: async (input) => {
      tokenHashStored = input.tokenHash;
      return createMockSession(input);
    },
  });

  assert.equal(tokenReceivedByHash, TEST_TOKEN);
  assert.equal(tokenHashStored, TEST_TOKEN_HASH);
  assert.notEqual(tokenHashStored, TEST_TOKEN);
});

test("Rechaza un identificador de participante inválido", async () => {
  const invalidIds = ["", "0", "-1", "abc", "17abc", " 17"];

  for (const participantId of invalidIds) {
    await assert.rejects(
      () => startParticipantSession(participantId),
      {
        message:
          "El identificador del participante no es válido.",
      },
    );
  }
});

test("Propaga un error si PostgreSQL no puede guardar la sesión", async () => {
  await assert.rejects(
    () =>
      startParticipantSession("17", {
        generateToken: () => TEST_TOKEN,
        hashToken: () => TEST_TOKEN_HASH,
        now: () => FIXED_DATE,

        createSession: async () => {
          throw new Error("Error de base de datos.");
        },
      }),
    {
      message: "Error de base de datos.",
    },
  );
});

test("No devuelve el hash del token en el resultado", async () => {
  const result = await startParticipantSession("17", {
    generateToken: () => TEST_TOKEN,
    hashToken: () => TEST_TOKEN_HASH,
    now: () => FIXED_DATE,

    createSession: async (input) => createMockSession(input),
  });

  assert.deepEqual(Object.keys(result).sort(), [
    "expiresAt",
    "sessionId",
    "token",
  ]);

  assert.equal(
    Object.values(result).includes(TEST_TOKEN_HASH),
    false,
  );
});


test("Valida una sesión activa utilizando el hash del token", async () => {
  const token = "a".repeat(64);
  const tokenHash = "b".repeat(64);

  const expectedSession: ParticipantSession = {
    id: "25",
    participant_id: "17",
    token_hash: tokenHash,
    created_at: FIXED_DATE,
    expires_at: EXPECTED_EXPIRATION,
    revoked_at: null,
  };

  let receivedToken: string | undefined;
  let receivedHash: string | undefined;

  const result = await validateParticipantSession(token, {
    hashToken: (value) => {
      receivedToken = value;
      return tokenHash;
    },

    findActiveSession: async (hash) => {
      receivedHash = hash;
      return expectedSession;
    },
  });

  assert.equal(receivedToken, token);
  assert.equal(receivedHash, tokenHash);
  assert.deepEqual(result, expectedSession);
});

test("Rechaza tokens con formato inválido sin consultar PostgreSQL", async () => {
  const invalidTokens = [
    "",
    "abc",
    "a".repeat(63),
    "a".repeat(65),
    "g".repeat(64),
    "A".repeat(64),
    " ".repeat(64),
  ];

  let databaseCalls = 0;
  let hashCalls = 0;

  for (const token of invalidTokens) {
    const result = await validateParticipantSession(token, {
      hashToken: () => {
        hashCalls++;
        return "b".repeat(64);
      },

      findActiveSession: async () => {
        databaseCalls++;
        return null;
      },
    });

    assert.equal(result, null);
  }

  assert.equal(hashCalls, 0);
  assert.equal(databaseCalls, 0);
});

test("Devuelve null cuando no encuentra una sesión activa", async () => {
  const result = await validateParticipantSession("a".repeat(64), {
    hashToken: () => "b".repeat(64),
    findActiveSession: async () => null,
  });

  assert.equal(result, null);
});

test("Propaga los errores de PostgreSQL al validar una sesión", async () => {
  await assert.rejects(
    () =>
      validateParticipantSession("a".repeat(64), {
        hashToken: () => "b".repeat(64),

        findActiveSession: async () => {
          throw new Error("Error al consultar la sesión.");
        },
      }),
    {
      message: "Error al consultar la sesión.",
    },
  );
});


test("Revoca una sesión utilizando el hash del token", async () => {
  const token = "a".repeat(64);
  const tokenHash = "b".repeat(64);

  let receivedToken: string | undefined;
  let receivedHash: string | undefined;

  const result = await endParticipantSession(token, {
    hashToken: (value) => {
      receivedToken = value;
      return tokenHash;
    },

    revokeSession: async (hash) => {
      receivedHash = hash;
      return true;
    },
  });

  assert.equal(result, true);
  assert.equal(receivedToken, token);
  assert.equal(receivedHash, tokenHash);
});

test("Rechaza tokens inválidos sin consultar PostgreSQL", async () => {
  const invalidTokens = [
    "",
    "abc",
    "a".repeat(63),
    "a".repeat(65),
    "g".repeat(64),
    "A".repeat(64),
    " ".repeat(64),
  ];

  let hashCalls = 0;
  let databaseCalls = 0;

  for (const token of invalidTokens) {
    const result = await endParticipantSession(token, {
      hashToken: () => {
        hashCalls++;
        return "b".repeat(64);
      },

      revokeSession: async () => {
        databaseCalls++;
        return true;
      },
    });

    assert.equal(result, false);
  }

  assert.equal(hashCalls, 0);
  assert.equal(databaseCalls, 0);
});

test("Devuelve false cuando no existe una sesión activa", async () => {
  const result = await endParticipantSession("a".repeat(64), {
    hashToken: () => "b".repeat(64),
    revokeSession: async () => false,
  });

  assert.equal(result, false);
});

test("Propaga los errores de PostgreSQL al revocar una sesión", async () => {
  await assert.rejects(
    () =>
      endParticipantSession("a".repeat(64), {
        hashToken: () => "b".repeat(64),

        revokeSession: async () => {
          throw new Error("Error al revocar la sesión.");
        },
      }),
    {
      message: "Error al revocar la sesión.",
    },
  );
});
