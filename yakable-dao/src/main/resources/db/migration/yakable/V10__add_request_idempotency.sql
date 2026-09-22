ALTER TABLE yak_project
    ADD COLUMN request_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '客户端创建请求ID' AFTER name,
    ADD UNIQUE KEY uk_project_create_by_request_id (create_by, request_id);

ALTER TABLE yak_turn
    ADD COLUMN request_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '客户端创建请求ID' AFTER session_id,
    ADD UNIQUE KEY uk_turn_session_request_id (session_id, request_id);
