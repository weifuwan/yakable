package io.yakable.common.bean.dto.session;

import jakarta.validation.constraints.NotBlank;

/**
 * 新增 Turn 入参。
 */
public record AddTurnDTO(
        @NotBlank String projectId,
        @NotBlank String sessionId,
        @NotBlank String content) {
}
