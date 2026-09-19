ALTER TABLE yak_turn
    ADD COLUMN provider VARCHAR(128) NULL;

ALTER TABLE yak_turn
    ADD COLUMN model VARCHAR(128) NULL;

ALTER TABLE yak_turn
    ADD COLUMN input_tokens BIGINT NULL;

ALTER TABLE yak_turn
    ADD COLUMN output_tokens BIGINT NULL;

ALTER TABLE yak_turn
    ADD COLUMN total_tokens BIGINT NULL;

ALTER TABLE yak_turn
    ADD COLUMN provider_request_id VARCHAR(255) NULL;

ALTER TABLE yak_turn
    ADD COLUMN finish_reason VARCHAR(128) NULL;

UPDATE yak_turn
SET provider = (
        SELECT yak_session.provider
        FROM yak_session
        WHERE yak_session.id = yak_turn.session_id
    ),
    model = (
        SELECT yak_session.model
        FROM yak_session
        WHERE yak_session.id = yak_turn.session_id
    )
WHERE status IN ('RUNNING', 'SUCCEEDED', 'FAILED');
