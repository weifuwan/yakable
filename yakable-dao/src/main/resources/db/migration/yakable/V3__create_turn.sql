CREATE TABLE yak_turn (
    id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_yak_turn PRIMARY KEY (id),
    CONSTRAINT fk_yak_turn_session
        FOREIGN KEY (session_id)
        REFERENCES yak_session (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_yak_turn_session_id
    ON yak_turn (session_id);

CREATE INDEX idx_yak_turn_session_status
    ON yak_turn (session_id, status);
