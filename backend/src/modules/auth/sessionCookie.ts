
import type { CookieOptions, Response } from "express";

export const SESSION_COOKIE_NAME = "pauta_session";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  };
}

export function setSessionCookie(
  res: Response,
  token: string,
): void {
  res.cookie(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(),
  );
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } =
    getSessionCookieOptions();

  res.clearCookie(SESSION_COOKIE_NAME, options);
}



export function readSessionTokenFromCookie(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  let sessionToken: string | null = null;
  let sessionCookieCount = 0;

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name !== SESSION_COOKIE_NAME) {
      continue;
    }

    sessionCookieCount++;

    if (sessionCookieCount > 1) {
      return null;
    }

    const value = cookie.slice(separatorIndex + 1).trim();

    if (!/^[a-f0-9]{64}$/.test(value)) {
      return null;
    }

    sessionToken = value;
  }

  return sessionToken;
}

