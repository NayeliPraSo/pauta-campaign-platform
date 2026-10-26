
import { rateLimit } from "express-rate-limit";

export const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Demasiados intentos de registro. Inténtalo nuevamente más tarde.",
  },
});
