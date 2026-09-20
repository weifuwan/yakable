package io.yakable.common.bean.dto.session;

import jakarta.validation.constraints.NotBlank;

/**
 * 查询 Session 入参。
 */
public record QuerySessionDTO(@NotBlank String projectId, @NotBlank String sessionId) {
}
