
import type { TicketHistorial, TicketStatus } from "./tickets";

export interface TicketStats {
  total: number;
  pending: number;
  processing: number;
  approved: number;
  rejected: number;
  requires_review: number;
}

export function calcularEstadisticasTickets(
  tickets: TicketHistorial[],
): TicketStats {
  const stats: TicketStats = {
    total: tickets.length,
    pending: 0,
    processing: 0,
    approved: 0,
    rejected: 0,
    requires_review: 0,
  };

  for (const ticket of tickets) {
    const status: TicketStatus = ticket.status;
    stats[status] += 1;
  }

  return stats;
}
