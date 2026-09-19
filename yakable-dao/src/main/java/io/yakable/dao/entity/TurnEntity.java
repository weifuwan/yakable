package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("yak_turn")
public class TurnEntity {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("session_id")
    private String sessionId;

    private String status;

    @TableField("attempt_count")
    private Integer attemptCount;

    @TableField("error_message")
    private String errorMessage;

    private String provider;
    private String model;

    @TableField("input_tokens")
    private Long inputTokens;

    @TableField("output_tokens")
    private Long outputTokens;

    @TableField("total_tokens")
    private Long totalTokens;

    @TableField("provider_request_id")
    private String providerRequestId;

    @TableField("finish_reason")
    private String finishReason;

    @TableField("started_at")
    private Instant startedAt;

    @TableField("finished_at")
    private Instant finishedAt;

    @TableField("created_at")
    private Instant createdAt;

    @TableField("updated_at")
    private Instant updatedAt;
}
