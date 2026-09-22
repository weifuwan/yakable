UPDATE yak_turn t
JOIN yak_session s ON s.id = t.session_id
SET
    t.provider = COALESCE(t.provider, s.provider),
    t.model = COALESCE(t.model, s.model)
WHERE t.provider IS NULL
   OR t.model IS NULL;

ALTER TABLE yak_turn
    MODIFY COLUMN status TINYINT NOT NULL COMMENT '执行轮次状态：0-待执行，1-执行中，2-成功，3-失败，4-已停止',
    MODIFY COLUMN provider VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '本轮模型提供商',
    MODIFY COLUMN model VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '本轮模型名称';
