ALTER TABLE yak_project
    CHANGE COLUMN created_at create_time TIMESTAMP(6) NOT NULL,
    CHANGE COLUMN updated_at update_time TIMESTAMP(6) NOT NULL;

ALTER TABLE yak_project
    ADD COLUMN create_by VARCHAR(64) NOT NULL DEFAULT 'system',
    ADD COLUMN update_by VARCHAR(64) NOT NULL DEFAULT 'system';

ALTER TABLE yak_session
    CHANGE COLUMN created_at create_time TIMESTAMP(6) NOT NULL,
    CHANGE COLUMN updated_at update_time TIMESTAMP(6) NOT NULL;

ALTER TABLE yak_session
    ADD COLUMN create_by VARCHAR(64) NOT NULL DEFAULT 'system',
    ADD COLUMN update_by VARCHAR(64) NOT NULL DEFAULT 'system';

ALTER TABLE yak_turn
    CHANGE COLUMN created_at create_time TIMESTAMP(6) NOT NULL,
    CHANGE COLUMN updated_at update_time TIMESTAMP(6) NOT NULL;

ALTER TABLE yak_turn
    ADD COLUMN create_by VARCHAR(64) NOT NULL DEFAULT 'system',
    ADD COLUMN update_by VARCHAR(64) NOT NULL DEFAULT 'system';

ALTER TABLE yak_message
    CHANGE COLUMN created_at create_time TIMESTAMP(6) NOT NULL,
    ADD COLUMN update_time TIMESTAMP(6) NULL,
    ADD COLUMN create_by VARCHAR(64) NOT NULL DEFAULT 'system',
    ADD COLUMN update_by VARCHAR(64) NOT NULL DEFAULT 'system';

UPDATE yak_message
SET update_time = create_time
WHERE update_time IS NULL;

ALTER TABLE yak_message
    MODIFY COLUMN update_time TIMESTAMP(6) NOT NULL;
