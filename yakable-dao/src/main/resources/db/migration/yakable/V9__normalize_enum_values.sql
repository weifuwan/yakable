UPDATE yak_project
SET status = CASE status
    WHEN 'CREATED' THEN '0'
    ELSE '0'
END;

ALTER TABLE yak_project
    MODIFY COLUMN status TINYINT NOT NULL;

UPDATE yak_session
SET status = CASE status
    WHEN 'ACTIVE' THEN '0'
    ELSE '1'
END;

ALTER TABLE yak_session
    MODIFY COLUMN status TINYINT NOT NULL;

UPDATE yak_turn
SET status = CASE status
    WHEN 'PENDING' THEN '0'
    WHEN 'RUNNING' THEN '1'
    WHEN 'SUCCEEDED' THEN '2'
    WHEN 'FAILED' THEN '3'
    ELSE '0'
END;

ALTER TABLE yak_turn
    MODIFY COLUMN status TINYINT NOT NULL;

UPDATE yak_message
SET role = CASE role
    WHEN 'USER' THEN '0'
    WHEN 'ASSISTANT' THEN '1'
    WHEN 'SYSTEM' THEN '2'
    ELSE '0'
END;

ALTER TABLE yak_message
    MODIFY COLUMN role TINYINT NOT NULL;
