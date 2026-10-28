
import { Router } from "express";

import { requireAuth } from "../auth/middlewares/requireAuth.middleware.js";
import { requireTrustedOrigin } from "../auth/middlewares/requireTrustedOrigin.middleware.js";

import { uploadTicket } from "./middlewares/uploadTicket.middleware.js";
import { validateUploadedTicket } from "./middlewares/validateUploadedTicket.middleware.js";
import { handleTicketUploadError } from "./middlewares/handleTicketUploadError.middleware.js";

export const ticketsRouter = Router();

ticketsRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  uploadTicket.single("file"),
  validateUploadedTicket,
  (req, res) => {
    const file = req.file!;

    res.status(200).json({
      success: true,
      message: "El archivo superó las validaciones iniciales.",
      data: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  },
);

ticketsRouter.use(handleTicketUploadError);
