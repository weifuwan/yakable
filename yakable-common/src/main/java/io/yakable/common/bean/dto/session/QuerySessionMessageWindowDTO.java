package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * 查询 Session 目标消息窗口入参。
 */
@Schema(description = "查询 Session 目标消息窗口参数")
public record QuerySessionMessageWindowDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(description = "目标 Message 序号") @Positive long anchorSequence,
        @Schema(hidden = true) @NotBlank String userId) {
}
