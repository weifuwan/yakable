CREATE INDEX idx_session_create_by_project_update_time_id
    ON yak_session (create_by, project_id, update_time, id);
