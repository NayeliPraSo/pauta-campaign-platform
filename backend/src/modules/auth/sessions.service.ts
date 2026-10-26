
import {
  createParticipantSession,
  findActiveParticipantSessionByTokenHash,
  revokeParticipantSessionByTokenHash,
  type CreateParticipantSessionInput,
  type ParticipantSession,
} from "./sessions.repository.js";

import {
  generateSessionToken,
  hashSessionToken,
} from "./sessionToken.js";

const SESSION_DURATION_HOURS = 12;

const SESSION_DURATION_MS =
  SESSION_DURATION_HOURS * 60 * 60 * 1000;

export interface CreateSessionResult {
  token: string;
  expiresAt: Date;
  sessionId: string;
}

export interface SessionServiceDependencies {
  createSession?: (
    input: CreateParticipantSessionInput,
  ) => Promise<ParticipantSession>;

  generateToken?: () => string;

  hashToken?: (token: string) => string;

  now?: () => Date;
}

export async function startParticipantSession(
  participantId: string,
  dependencies: SessionServiceDependencies = {},
): Promise<CreateSessionResult> {
  if (!/^[1-9]\d*$/.test(participantId)) {
    throw new Error("El identificador del participante no es válido.");
  }

  const createSession =
    dependencies.createSession ?? createParticipantSession;

  const generateToken =
    dependencies.generateToken ?? generateSessionToken;

  const hashToken =
    dependencies.hashToken ?? hashSessionToken;

  const now = dependencies.now ?? (() => new Date());

  const token = generateToken();

  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    now().getTime() + SESSION_DURATION_MS,
  );

  const session = await createSession({
    participantId,
    tokenHash,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    sessionId: session.id,
  };
}


export interface ValidateSessionDependencies {
  hashToken?: (token: string) => string;

  findActiveSession?: (
    tokenHash: string,
  ) => Promise<ParticipantSession | null>;
}

export async function validateParticipantSession(
  token: string,
  dependencies: ValidateSessionDependencies = {},
): Promise<ParticipantSession | null> {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }

  const hashToken =
    dependencies.hashToken ?? hashSessionToken;

  const findActiveSession =
    dependencies.findActiveSession ??
    findActiveParticipantSessionByTokenHash;

  const tokenHash = hashToken(token);

  const session = await findActiveSession(tokenHash);

  return session;
}


export interface RevokeSessionDependencies {
  hashToken?: (token: string) => string;

  revokeSession?: (tokenHash: string) => Promise<boolean>;
}

export async function endParticipantSession(
  token: string,
  dependencies: RevokeSessionDependencies = {},
): Promise<boolean> {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return false;
  }

  const hashToken =
    dependencies.hashToken ?? hashSessionToken;

  const revokeSession =
    dependencies.revokeSession ??
    revokeParticipantSessionByTokenHash;

  const tokenHash = hashToken(token);

  return revokeSession(tokenHash);
}
