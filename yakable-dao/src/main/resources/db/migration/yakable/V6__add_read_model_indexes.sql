CREATE INDEX idx_yak_session_project_updated_id
    ON yak_session (project_id, updated_at, id);

CREATE INDEX idx_yak_turn_session_created_id
    ON yak_turn (session_id, created_at, id);
