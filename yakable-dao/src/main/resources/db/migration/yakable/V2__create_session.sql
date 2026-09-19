CREATE TABLE yak_session (
    id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    provider VARCHAR(128) NOT NULL,
    model VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_yak_session PRIMARY KEY (id),
    CONSTRAINT fk_yak_session_project
        FOREIGN KEY (project_id)
        REFERENCES yak_project (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_yak_session_project_id
    ON yak_session (project_id);

CREATE INDEX idx_yak_session_project_updated_at
    ON yak_session (project_id, updated_at);
