
import { hashPassword } from "./password.js";
import { pool } from "../../database/connection.js";
import { createParticipantConsent } from "./consents.repository.js";
import type { PoolClient } from "pg";
import { getLegalDocumentVersions } from "./legal.config.js";
import {
  createParticipant,
  findParticipantByEmail,
} from "./participants.repository.js";

export interface RegisterParticipantInput {
  full_name: string;
  email: string;
  password: string;
  accepted_terms: boolean;
  accepted_privacy: boolean;
}

export interface RegisteredParticipant {
  id: string;
  full_name: string;
  email: string;
}

export interface RegisterParticipantDependencies {
  createConsent?: (
    client: PoolClient,
    data: {
      participant_id: string;
      terms_version: string;
      privacy_version: string;
    },
  ) => Promise<void>;
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class ParticipantAlreadyExistsError extends Error {
  constructor() {
    super("Ya existe una cuenta registrada con ese correo electrónico.");
    this.name = "ParticipantAlreadyExistsError";
  }
}

export async function registerParticipant(
  input: RegisterParticipantInput,
  dependencies: RegisterParticipantDependencies = {},
): Promise<RegisteredParticipant> {
  const fullName = input.full_name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password;

  if (!fullName || fullName.length > 150) {
    throw new AuthValidationError(
      "El nombre debe contener entre 1 y 150 caracteres.",
    );
  }

  if (
    input.accepted_terms !== true ||
    input.accepted_privacy !== true
  ) {
    throw new AuthValidationError(
      "Debes aceptar los términos y el aviso de privacidad.",
    );
  }

  if (
    !email ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new AuthValidationError(
      "Debes proporcionar un correo electrónico válido.",
    );
  }

  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    throw new AuthValidationError(
      "La contraseña debe tener al menos 12 caracteres y no superar 1024 bytes.",
    );
  }

  const { termsVersion, privacyVersion } =
  getLegalDocumentVersions();

  const existingParticipant = await findParticipantByEmail(email);

  if (existingParticipant) {
    throw new ParticipantAlreadyExistsError();
  }

  const passwordHash = await hashPassword(password);

  
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const participant = await createParticipant(
    {
      full_name: fullName,
      email,
      password_hash: passwordHash,
    },
    client,
  );

  const createConsent =
  dependencies.createConsent ?? createParticipantConsent;

  await createConsent(client, {
    participant_id: participant.id,
    terms_version: termsVersion,
    privacy_version: privacyVersion,
  });

  await client.query("COMMIT");

  return {
    id: participant.id,
    full_name: participant.full_name,
    email: participant.email,
  };
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error(
      "No fue posible revertir la transacción de registro:",
      rollbackError,
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    throw new ParticipantAlreadyExistsError();
  }

  throw error;
} finally {
  client.release();
}

}
