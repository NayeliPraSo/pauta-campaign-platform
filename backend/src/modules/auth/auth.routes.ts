
import { Router } from "express";

import { registerParticipantController } from "./auth.controller.js";
import { loginParticipantController } from "./login.controller.js";
import { getCurrentParticipantController } from "./me.controller.js";

import { registerRateLimit } from "./middlewares/registerRateLimit.middleware.js";
import { loginRateLimit } from "./middlewares/loginRateLimit.middleware.js";
import { requireAuth } from "./middlewares/requireAuth.middleware.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  registerRateLimit,
  (req, res) => {
    void registerParticipantController(req, res);
  },
);

authRouter.post(
  "/login",
  loginRateLimit,
  (req, res) => {
    void loginParticipantController(req, res);
  },
);

authRouter.get(
  "/me",
  requireAuth,
  (req, res) => {
    void getCurrentParticipantController(req, res);
  },
);
