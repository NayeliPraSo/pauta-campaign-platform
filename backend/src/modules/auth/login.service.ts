
import { AuthValidationError } from "./auth.service.js";
import {
  findParticipantByEmail,
} from "./participants.repository.js";
import { verifyPassword } from "./password.js";
import type { Participant } from "./participants.repository.js";

export { AuthValidationError };

const DUMMY_PASSWORD_HASH =
  `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

export interface LoginParticipantInput {
  email: string;
  password: string;
}

export interface AuthenticatedParticipant {
  id: string;
  full_name: string;
  email: string;
}

export interface LoginParticipantDependencies {
  findParticipant?: (email: string) => Promise<Participant | null>;
  verifyParticipantPassword?: (
    password: string,
    storedHash: string,
  ) => Promise<boolean>;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Correo electrónico o contraseña incorrectos.");
    this.name = "InvalidCredentialsError";
  }
}

export function validateLoginInput(
  input: LoginParticipantInput,
): LoginParticipantInput {
  const email =
    typeof input?.email === "string"
      ? input.email.trim().toLowerCase()
      : "";

  const password = input?.password;

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
    password.length === 0 ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    throw new AuthValidationError(
      "Debes proporcionar una contraseña válida.",
    );
  }

  return {
    email,
    password,
  };
}



export async function loginParticipant(
  input: LoginParticipantInput,
  dependencies: LoginParticipantDependencies = {},
): Promise<AuthenticatedParticipant> {
  const { email, password } = validateLoginInput(input);

  const findParticipant =
    dependencies.findParticipant ?? findParticipantByEmail;

  const verifyParticipantPassword =
    dependencies.verifyParticipantPassword ?? verifyPassword;

  const participant = await findParticipant(email);

  const passwordHash =
    participant?.password_hash ?? DUMMY_PASSWORD_HASH;

  const passwordIsValid = await verifyParticipantPassword(
    password,
    passwordHash,
  );

  if (
    !participant ||
    !passwordIsValid ||
    !participant.is_active
  ) {
    throw new InvalidCredentialsError();
  }

  return {
    id: participant.id,
    full_name: participant.full_name,
    email: participant.email,
  };
}


