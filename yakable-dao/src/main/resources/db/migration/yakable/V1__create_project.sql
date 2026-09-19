CREATE TABLE yak_project (
    id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_yak_project PRIMARY KEY (id)
);

CREATE INDEX idx_yak_project_updated_at
    ON yak_project (updated_at);
