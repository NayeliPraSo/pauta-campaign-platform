
import { pool } from "../../database/connection";

export interface ExistingDuplicateTicket {
  id: string;
  status: string;
}

export async function findTicketByFileHash(
  fileHash: string,
): Promise<ExistingDuplicateTicket | null> {
  if (!/^[a-f0-9]{64}$/.test(fileHash)) {
    throw new Error("El hash SHA-256 proporcionado es inválido.");
  }

  const result = await pool.query<ExistingDuplicateTicket>(
    `
      SELECT
        id::text AS id,
        status
      FROM tickets
      WHERE file_hash = $1
      LIMIT 1
    `,
    [fileHash],
  );

  return result.rows[0] ?? null;
}


export interface TicketDuplicateData {
  ticket_number: string;
  merchant_name: string;
  purchase_date: string;
}

export async function findTicketByPurchaseData(
  data: TicketDuplicateData,
): Promise<ExistingDuplicateTicket | null> {
  const ticketNumber = data.ticket_number.trim();
  const merchantName = data.merchant_name.trim();
  const purchaseDate = data.purchase_date;

  if (!ticketNumber || !merchantName) {
    throw new Error(
      "El número de ticket y el comercio son obligatorios.",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
    Number.isNaN(Date.parse(`${purchaseDate}T00:00:00Z`)) ||
    new Date(`${purchaseDate}T00:00:00Z`)
      .toISOString()
      .slice(0, 10) !== purchaseDate
  ) {
    throw new Error("La fecha de compra es inválida.");
  }

  const result = await pool.query<ExistingDuplicateTicket>(
    `SELECT id::text AS id, status
     FROM tickets
     WHERE ticket_number = $1
       AND LOWER(TRIM(merchant_name)) = LOWER($2)
       AND purchase_date = $3::date
     LIMIT 1`,
    [ticketNumber, merchantName, purchaseDate],
  );

  return result.rows[0] ?? null;
}


export async function findTicketByVeryfiDocumentId(
  documentId: number,
): Promise<ExistingDuplicateTicket | null> {
  if (
    !Number.isSafeInteger(documentId) ||
    documentId <= 0
  ) {
    throw new Error(
      "El identificador del documento Veryfi es inválido.",
    );
  }

  const result = await pool.query<ExistingDuplicateTicket>(
    `SELECT
       id::text AS id,
       status
     FROM tickets
     WHERE veryfi_document_id = $1
     LIMIT 1`,
    [documentId],
  );

  return result.rows[0] ?? null;
}
