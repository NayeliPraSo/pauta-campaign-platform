
CREATE TABLE campaign_settings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    campaign_name VARCHAR(150) NOT NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/Mexico_City',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT campaign_settings_single_row CHECK (id = 1),
    CONSTRAINT campaign_settings_valid_dates
        CHECK (
            starts_at IS NULL
            OR ends_at IS NULL
            OR ends_at > starts_at
        )
);
