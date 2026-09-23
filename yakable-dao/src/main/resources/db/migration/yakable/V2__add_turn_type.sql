ALTER TABLE yak_turn
    ADD COLUMN turn_type TINYINT NOT NULL DEFAULT 0 COMMENT '执行轮次类型：0-普通会话，1-项目代码生成' AFTER request_id;
