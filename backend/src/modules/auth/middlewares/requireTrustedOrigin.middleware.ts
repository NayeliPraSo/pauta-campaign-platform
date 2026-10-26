
import type {
  Request,
  Response,
  NextFunction,
} from "express";

const TRUSTED_ORIGINS = new Set([
  "http://localhost:4321",
  "http://localhost:3000",
]);

export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.get("origin");
  const referer = req.get("referer");

  let requestOrigin: string | null = null;

  if (origin !== undefined) {
    requestOrigin = origin;
  } else if (referer !== undefined) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = null;
    }
  }

  if (
    requestOrigin === null ||
    !TRUSTED_ORIGINS.has(requestOrigin)
  ) {
    res.status(403).json({
      success: false,
      message: "El origen de la solicitud no está permitido.",
    });

    return;
  }

  next();
}
