package io.yakable.common.bean.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * 查询 Session 消息入参。
 */
public record QuerySessionMessagesDTO(
        @NotBlank String projectId,
        @NotBlank String sessionId,
        @Positive Long beforeSequence,
        @Min(1) @Max(100) int limit) {
}
