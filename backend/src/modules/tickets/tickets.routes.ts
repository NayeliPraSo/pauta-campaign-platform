
import { Router } from "express";

import { requireAuth } from "../auth/middlewares/requireAuth.middleware.js";
import { requireTrustedOrigin } from "../auth/middlewares/requireTrustedOrigin.middleware.js";

import { uploadTicket } from "./middlewares/uploadTicket.middleware.js";
import { validateUploadedTicket } from "./middlewares/validateUploadedTicket.middleware.js";
import { handleTicketUploadError } from "./middlewares/handleTicketUploadError.middleware.js";

import {
  DuplicateTicketError,
  registerTicket,
} from "./tickets.service.js";

export const ticketsRouter = Router();

ticketsRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  uploadTicket.single("file"),
  validateUploadedTicket,
  async (req, res) => {
    try {
      const file = req.file!;

      const auth = res.locals.auth as {
        participantId: string;
        sessionId: string;
      };

      const ticket = await registerTicket({
        participantId: auth.participantId,
        fileBuffer: file.buffer,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
      });

      res.status(201).json({
        success: true,
        message: "El comprobante se registró correctamente.",
        data: {
          id: ticket.id,
          status: ticket.status,
          createdAt: ticket.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof DuplicateTicketError) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }

      console.error(
        "Error al registrar el comprobante:",
        error,
      );

      res.status(500).json({
        success: false,
        message: "No fue posible registrar el comprobante.",
      });
    }
  },
);

ticketsRouter.use(handleTicketUploadError);
