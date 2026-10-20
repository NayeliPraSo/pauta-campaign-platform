
CREATE TABLE validation_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    rule_type VARCHAR(100) NOT NULL UNIQUE,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    failure_action VARCHAR(30) NOT NULL DEFAULT 'requires_review',

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT validation_rules_configuration_object
        CHECK (jsonb_typeof(configuration) = 'object'),

    CONSTRAINT validation_rules_valid_action
        CHECK (
            failure_action IN (
                'rejected',
                'requires_review'
            )
        )
);
