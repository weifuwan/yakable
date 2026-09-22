package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 订阅 Turn 流式输出入参。
 */
@Schema(description = "订阅 Turn 流式输出参数")
public record WatchTurnDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(description = "Turn ID") @NotBlank String turnId,
        @Schema(hidden = true) @NotBlank String userId) {
}
