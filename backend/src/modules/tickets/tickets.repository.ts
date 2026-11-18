
import { pool } from "../../database/connection.js";

export interface CreateTicketInput {
  participantId: string;
  originalFilename: string;
  filePath: string;
  mimeType: string;
  fileHash: string;
}

export interface CreatedTicket {
  id: string;
  participantId: string;
  status: string;
  createdAt: Date;
}

interface CreatedTicketRow {
  id: string;
  participant_id: string;
  status: string;
  created_at: Date;
}

export type CreateTicketQuery = (
  sql: string,
  values: readonly string[],
) => Promise<{
  rows: CreatedTicketRow[];
}>;

export async function createTicket(
  input: CreateTicketInput,
  query: CreateTicketQuery = (sql, values) =>
    pool.query<CreatedTicketRow>(sql, [...values]),
): Promise<CreatedTicket> {
  const result = await query(
    `
      INSERT INTO tickets (
        participant_id,
        original_filename,
        file_path,
        mime_type,
        file_hash,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING
        id::text AS id,
        participant_id::text AS participant_id,
        status,
        created_at
    `,
    [
      input.participantId,
      input.originalFilename,
      input.filePath,
      input.mimeType,
      input.fileHash,
    ],
  );

  const ticket = result.rows[0];

  if (!ticket) {
    throw new Error(
      "No fue posible recuperar el ticket registrado.",
    );
  }

  return {
    id: ticket.id,
    participantId: ticket.participant_id,
    status: ticket.status,
    createdAt: ticket.created_at,
  };
}

export interface ParticipantTicket {
  id: string;
  originalFilename: string;
  mimeType: string;
  status: string;
  createdAt: Date;
}

interface ParticipantTicketRow {
  id: string;
  original_filename: string;
  mime_type: string;
  status: string;
  created_at: Date;
}

export type ListParticipantTicketsQuery = (
  sql: string,
  values: readonly string[],
) => Promise<{
  rows: ParticipantTicketRow[];
}>;

export async function listParticipantTickets(
  participantId: string,
  query: ListParticipantTicketsQuery = (sql, values) =>
    pool.query<ParticipantTicketRow>(sql, [...values]),
): Promise<ParticipantTicket[]> {
  const result = await query(
    `
      SELECT
        id::text AS id,
        original_filename,
        mime_type,
        status,
        created_at
      FROM tickets
      WHERE participant_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [participantId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    status: row.status,
    createdAt: row.created_at,
  }));
}


export interface SaveTicketOcrResultInput {
  ticketId: string;
  veryfiDocumentId: number;
  ocrData: Record<string, unknown>;
}

interface SavedTicketOcrRow {
  id: string;
}

export type SaveTicketOcrResultQuery = (
  sql: string,
  values: readonly (string | number)[],
) => Promise<{
  rows: SavedTicketOcrRow[];
}>;

export async function saveTicketOcrResult(
  input: SaveTicketOcrResultInput,
  query: SaveTicketOcrResultQuery = (sql, values) =>
    pool.query<SavedTicketOcrRow>(sql, [...values]),
): Promise<void> {
  if (
    !Number.isSafeInteger(input.veryfiDocumentId) ||
    input.veryfiDocumentId <= 0
  ) {
    throw new Error(
      "El identificador del documento Veryfi es inválido.",
    );
  }

  const result = await query(
    `
      UPDATE tickets
      SET
        ocr_data = $2::jsonb,
        veryfi_document_id = $3,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'pending'
      RETURNING id::text AS id
    `,
    [
      input.ticketId,
      JSON.stringify(input.ocrData),
      input.veryfiDocumentId,
    ],
  );

  if (result.rows.length !== 1) {
    throw new Error(
      "No fue posible guardar el resultado OCR del ticket.",
    );
  }
}
