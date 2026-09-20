package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Turn 展示对象。
 */
@Getter
@Setter
public class TurnVO {

    private String id;
    private String status;
    private Integer attemptCount;
    private String errorMessage;
    private TurnInvocationVO invocation;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private Long durationMs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
