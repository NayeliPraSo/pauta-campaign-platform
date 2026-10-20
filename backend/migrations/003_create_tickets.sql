
CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    participant_id BIGINT NOT NULL
        REFERENCES participants(id)
        ON DELETE RESTRICT,

    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    merchant_name VARCHAR(255),
    purchase_date DATE,
    total_amount NUMERIC(12, 2),
    currency CHAR(3) DEFAULT 'MXN',

    veryfi_document_id VARCHAR(100),
    ocr_data JSONB,

    rejection_reason TEXT,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tickets_valid_status CHECK (
        status IN (
            'pending',
            'processing',
            'approved',
            'rejected',
            'requires_review'
        )
    ),

    CONSTRAINT tickets_valid_amount CHECK (
        total_amount IS NULL OR total_amount >= 0
    )
);

CREATE INDEX tickets_participant_idx
    ON tickets (participant_id);

CREATE INDEX tickets_status_idx
    ON tickets (status);

CREATE UNIQUE INDEX tickets_veryfi_document_unique
    ON tickets (veryfi_document_id)
    WHERE veryfi_document_id IS NOT NULL;
