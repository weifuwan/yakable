package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * 查询 Session 增量变化入参。
 */
@Schema(description = "查询 Session 增量变化参数")
public record QuerySessionChangesDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(description = "已读取的 Message 序号", example = "0") @PositiveOrZero long afterSequence) {
}
