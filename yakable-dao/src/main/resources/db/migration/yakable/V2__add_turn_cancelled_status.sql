ALTER TABLE yak_turn
    MODIFY COLUMN status TINYINT NOT NULL COMMENT '执行轮次状态：0-待执行，1-执行中，2-成功，3-失败，4-已取消';
