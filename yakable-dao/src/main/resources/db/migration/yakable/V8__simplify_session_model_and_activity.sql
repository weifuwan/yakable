ALTER TABLE yak_session
    ADD COLUMN activity_time TIMESTAMP(6) NULL COMMENT '最近用户交互时间' AFTER model;

UPDATE yak_session
SET activity_time = update_time
WHERE activity_time IS NULL;

ALTER TABLE yak_session
    MODIFY COLUMN activity_time TIMESTAMP(6) NOT NULL COMMENT '最近用户交互时间',
    DROP COLUMN status,
    DROP INDEX idx_session_project_update_time_id,
    DROP INDEX idx_session_create_by_project_update_time_id,
    ADD UNIQUE KEY uk_session_project_id (project_id);
