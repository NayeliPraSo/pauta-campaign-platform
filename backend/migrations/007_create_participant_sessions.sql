
CREATE TABLE participant_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    participant_id BIGINT NOT NULL
        REFERENCES participants(id)
        ON DELETE CASCADE,

    token_hash CHAR(64) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    CONSTRAINT participant_sessions_expiration_check
        CHECK (expires_at > created_at)
);

CREATE INDEX participant_sessions_participant_id_idx
    ON participant_sessions (participant_id);

CREATE INDEX participant_sessions_expires_at_idx
    ON participant_sessions (expires_at);
