ALTER TABLE yak_turn
    ADD COLUMN attempt_count INT NOT NULL DEFAULT 0;

ALTER TABLE yak_turn
    ADD COLUMN started_at TIMESTAMP(6) NULL;

ALTER TABLE yak_turn
    ADD COLUMN finished_at TIMESTAMP(6) NULL;

UPDATE yak_turn
SET attempt_count = 1,
    started_at = CASE
        WHEN status = 'RUNNING' THEN updated_at
        ELSE created_at
    END,
    finished_at = CASE
        WHEN status IN ('SUCCEEDED', 'FAILED') THEN updated_at
        ELSE NULL
    END
WHERE status IN ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE INDEX idx_yak_turn_recovery
    ON yak_turn (status, started_at, created_at);
