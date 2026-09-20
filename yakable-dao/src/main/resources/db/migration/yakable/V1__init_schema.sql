CREATE TABLE yak_project (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID',
    name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '项目名称',
    status TINYINT NOT NULL COMMENT '项目状态：0-已创建',
    create_time TIMESTAMP(6) NOT NULL COMMENT '创建时间',
    update_time TIMESTAMP(6) NOT NULL COMMENT '更新时间',
    create_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '创建人ID',
    update_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新人ID',
    PRIMARY KEY (id),
    KEY idx_project_update_time_id (update_time, id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='项目表';

CREATE TABLE yak_session (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID',
    project_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '所属项目ID',
    title VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '会话标题',
    provider VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '模型提供商',
    model VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '模型名称',
    status TINYINT NOT NULL COMMENT '会话状态：0-活跃，1-已关闭',
    create_time TIMESTAMP(6) NOT NULL COMMENT '创建时间',
    update_time TIMESTAMP(6) NOT NULL COMMENT '更新时间',
    create_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '创建人ID',
    update_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新人ID',
    PRIMARY KEY (id),
    KEY idx_session_project_update_time_id (project_id, update_time, id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='会话表';

CREATE TABLE yak_turn (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID',
    session_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '所属会话ID',
    status TINYINT NOT NULL COMMENT '执行轮次状态：0-待执行，1-执行中，2-成功，3-失败',
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '执行尝试次数',
    error_message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '执行失败信息',
    provider VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '实际调用的模型提供商',
    model VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '实际调用的模型名称',
    input_tokens BIGINT UNSIGNED NULL COMMENT '输入Token数量',
    output_tokens BIGINT UNSIGNED NULL COMMENT '输出Token数量',
    total_tokens BIGINT UNSIGNED NULL COMMENT '总Token数量',
    provider_request_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '模型提供商请求ID',
    finish_reason VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '模型调用结束原因',
    started_at TIMESTAMP(6) NULL COMMENT '开始执行时间',
    finished_at TIMESTAMP(6) NULL COMMENT '执行完成时间',
    create_time TIMESTAMP(6) NOT NULL COMMENT '创建时间',
    update_time TIMESTAMP(6) NOT NULL COMMENT '更新时间',
    create_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '创建人ID',
    update_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新人ID',
    PRIMARY KEY (id),
    KEY idx_turn_session_status (session_id, status),
    KEY idx_turn_session_create_time_id (session_id, create_time, id),
    KEY idx_turn_status_started_at (status, started_at),
    KEY idx_turn_status_create_time_id (status, create_time, id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='执行轮次表';

CREATE TABLE yak_message (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID',
    session_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '所属会话ID',
    turn_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '所属执行轮次ID',
    role TINYINT NOT NULL COMMENT '消息角色：0-用户，1-助手，2-系统',
    content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '消息内容',
    message_sequence BIGINT UNSIGNED NOT NULL COMMENT '会话内消息序号',
    create_time TIMESTAMP(6) NOT NULL COMMENT '创建时间',
    update_time TIMESTAMP(6) NOT NULL COMMENT '更新时间',
    create_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '创建人ID',
    update_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新人ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_message_session_sequence (session_id, message_sequence),
    KEY idx_message_turn_id (turn_id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='会话消息表';
