package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * 查询 Session 消息入参。
 */
@Schema(description = "查询 Session 消息参数")
public record QuerySessionMessagesDTO(
        @Schema(description = "Project ID") @NotBlank String projectId,
        @Schema(description = "Session ID") @NotBlank String sessionId,
        @Schema(description = "向前翻页的 Message 序号") @Positive Long beforeSequence,
        @Schema(description = "返回数量", example = "50") @Min(1) @Max(100) int limit) {
}
