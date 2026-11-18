
import {
  Router,
  type RequestHandler,
} from "express";

import { requireAuth } from "../auth/middlewares/requireAuth.middleware.js";
import { requireTrustedOrigin } from "../auth/middlewares/requireTrustedOrigin.middleware.js";

import { uploadTicket } from "./middlewares/uploadTicket.middleware.js";
import { validateUploadedTicket } from "./middlewares/validateUploadedTicket.middleware.js";
import { handleTicketUploadError } from "./middlewares/handleTicketUploadError.middleware.js";

import {
  DuplicateTicketError,
  registerTicket,
} from "./tickets.service.js";

import { listParticipantTickets } from "./tickets.repository.js";

export interface TicketsRouterDependencies {
  authenticate?: RequestHandler;
  register?: typeof registerTicket;
  listTickets?: typeof listParticipantTickets;
}

export function createTicketsRouter(
  dependencies: TicketsRouterDependencies = {},
) {
  const ticketsRouter = Router();

  const authenticate =
    dependencies.authenticate ?? requireAuth;

  const register =
    dependencies.register ?? registerTicket;

  const listTickets =
    dependencies.listTickets ?? listParticipantTickets;

  // Consultar los comprobantes del participante.
  ticketsRouter.get(
    "/",
    authenticate,
    async (_req, res) => {
      try {
        const auth = res.locals.auth as {
          participantId: string;
          sessionId: string;
        };

        const tickets = await listTickets(
          auth.participantId,
        );

        res.status(200).json({
          success: true,
          data: tickets,
        });
      } catch (error) {
        console.error(
          "Error al consultar los comprobantes:",
          error,
        );

        res.status(500).json({
          success: false,
          message:
            "No fue posible consultar los comprobantes.",
        });
      }
    },
  );

  // Registrar un nuevo comprobante.
  ticketsRouter.post(
    "/",
    requireTrustedOrigin,
    authenticate,
    uploadTicket.single("file"),
    validateUploadedTicket,
    async (req, res) => {
      try {
        const file = req.file!;

        const auth = res.locals.auth as {
          participantId: string;
          sessionId: string;
        };

        const ticket = await register({
          participantId: auth.participantId,
          fileBuffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
        });

        res.status(201).json({
          success: true,
          message:
            ticket.ocrStatus === "processed"
              ? "El comprobante se registró y procesó correctamente. Su validación está pendiente."
              : "El comprobante se registró correctamente, pero su procesamiento está pendiente. No es necesario volver a subirlo.",
          data: {
            id: ticket.id,
            status: ticket.status,
            ocrStatus: ticket.ocrStatus,
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
          message:
            "No fue posible registrar el comprobante.",
        });
      }
    },
  );

  // Manejar errores durante la carga del archivo.
  ticketsRouter.use(handleTicketUploadError);

  return ticketsRouter;
}

// Router utilizado normalmente por el backend.
export const ticketsRouter = createTicketsRouter();
