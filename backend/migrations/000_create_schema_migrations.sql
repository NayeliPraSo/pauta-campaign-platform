
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
