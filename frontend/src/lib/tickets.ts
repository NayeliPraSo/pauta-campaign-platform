
import { apiFetch } from "./api";

export type TicketStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "requires_review";

export interface TicketRegistrado {
  id: string;
  status: TicketStatus;
  createdAt: string;
}

export interface RespuestaRegistroTicket {
  success: true;
  message: string;
  data: TicketRegistrado;
}

export interface TicketHistorial {
  id: string;
  originalFilename: string;
  mimeType: string;
  status: TicketStatus;
  createdAt: string;
}

export interface RespuestaHistorialTickets {
  success: true;
  data: TicketHistorial[];
}

export async function registrarTicket(
  file: File,
): Promise<RespuestaRegistroTicket> {
  const formData = new FormData();

  formData.append("file", file);

  return apiFetch<RespuestaRegistroTicket>(
    "/api/tickets",
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function obtenerHistorialTickets():
  Promise<RespuestaHistorialTickets> {
  return apiFetch<RespuestaHistorialTickets>(
    "/api/tickets",
    {
      method: "GET",
    },
  );
}
