
CREATE TABLE ticket_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    ticket_id BIGINT NOT NULL
        REFERENCES tickets(id)
        ON DELETE RESTRICT,

    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,

    review_type VARCHAR(20) NOT NULL,

    reviewer_id BIGINT,

    reason TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ticket_reviews_valid_type CHECK (
        review_type IN (
            'automatic',
            'manual',
            'system'
        )
    ),

    CONSTRAINT ticket_reviews_valid_status CHECK (
        new_status IN (
            'pending',
            'processing',
            'approved',
            'rejected',
            'requires_review'
        )
    ),

    CONSTRAINT ticket_reviews_valid_previous_status CHECK (
        previous_status IS NULL OR previous_status IN (
            'pending',
            'processing',
            'approved',
            'rejected',
            'requires_review'
        )
    )
);

CREATE INDEX ticket_reviews_ticket_idx
    ON ticket_reviews (ticket_id, created_at);
