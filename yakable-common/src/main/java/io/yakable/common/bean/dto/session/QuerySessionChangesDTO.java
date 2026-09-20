package io.yakable.common.bean.dto.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * 查询 Session 增量变化入参。
 */
public record QuerySessionChangesDTO(
        @NotBlank String projectId,
        @NotBlank String sessionId,
        @PositiveOrZero long afterSequence) {
}
