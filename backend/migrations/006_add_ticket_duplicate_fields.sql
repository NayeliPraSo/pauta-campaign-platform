
-- Identificador SHA-256 del archivo original.
-- Se almacena como una cadena hexadecimal de 64 caracteres.

ALTER TABLE tickets
ADD COLUMN file_hash VARCHAR(64);

-- Folio o número de ticket identificado mediante OCR.
-- Puede ser NULL cuando el comprobante no lo contiene.

ALTER TABLE tickets
ADD COLUMN ticket_number VARCHAR(100);

-- Evita que se registren dos archivos idénticos.
-- El índice es global para todos los participantes.

CREATE UNIQUE INDEX tickets_file_hash_unique
ON tickets (file_hash)
WHERE file_hash IS NOT NULL;

-- Facilita la búsqueda de posibles duplicados por folio.

CREATE INDEX tickets_ticket_number_idx
ON tickets (ticket_number)
WHERE ticket_number IS NOT NULL;
