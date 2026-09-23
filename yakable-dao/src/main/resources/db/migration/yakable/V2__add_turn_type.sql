ALTER TABLE yak_turn
    ADD COLUMN turn_type TINYINT NULL COMMENT '执行轮次类型：0-普通会话，1-项目代码生成' AFTER request_id;

UPDATE yak_turn
SET turn_type = 0
WHERE turn_type IS NULL;

ALTER TABLE yak_turn
    MODIFY COLUMN turn_type TINYINT NOT NULL COMMENT '执行轮次类型：0-普通会话，1-项目代码生成';
