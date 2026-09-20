package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.session.TurnStatusEnum;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@TableName("yak_turn")
public class TurnEntity extends BaseEntity {

    private String sessionId;
    private TurnStatusEnum status;
    private Integer attemptCount;
    private String errorMessage;
    private String provider;
    private String model;
    private Long inputTokens;
    private Long outputTokens;
    private Long totalTokens;
    private String providerRequestId;
    private String finishReason;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
}
