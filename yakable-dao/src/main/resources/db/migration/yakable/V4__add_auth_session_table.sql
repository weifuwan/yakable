CREATE TABLE yak_auth_session (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID',
    user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户ID',
    token_hash VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'Session Token Hash',
    expires_at TIMESTAMP(6) NOT NULL COMMENT '过期时间',
    revoked_at TIMESTAMP(6) NULL COMMENT '撤销时间',
    create_time TIMESTAMP(6) NOT NULL COMMENT '创建时间',
    update_time TIMESTAMP(6) NOT NULL COMMENT '更新时间',
    create_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '创建人ID',
    update_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新人ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_session_token_hash (token_hash),
    KEY idx_auth_session_user_revoked_at (user_id, revoked_at),
    KEY idx_auth_session_expires_at (expires_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='用户登录Session表';
