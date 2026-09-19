CREATE TABLE yak_message (
    id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    turn_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    message_sequence BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_yak_message PRIMARY KEY (id),
    CONSTRAINT uk_yak_message_session_sequence
        UNIQUE (session_id, message_sequence),
    CONSTRAINT fk_yak_message_session
        FOREIGN KEY (session_id)
        REFERENCES yak_session (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_yak_message_turn
        FOREIGN KEY (turn_id)
        REFERENCES yak_turn (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_yak_message_session_id
    ON yak_message (session_id);

CREATE INDEX idx_yak_message_turn_id
    ON yak_message (turn_id);
