
CREATE TABLE participants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    phone VARCHAR(30),

    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX participants_email_unique
    ON participants (LOWER(email));

CREATE TABLE participant_consents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    participant_id BIGINT NOT NULL
        REFERENCES participants(id)
        ON DELETE RESTRICT,

    terms_version VARCHAR(50) NOT NULL,
    privacy_version VARCHAR(50) NOT NULL,

    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX participant_consents_participant_idx
    ON participant_consents (participant_id);

