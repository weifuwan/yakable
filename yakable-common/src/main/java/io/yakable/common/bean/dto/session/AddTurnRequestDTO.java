package io.yakable.common.bean.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 新增 Turn 请求体。
 */
@Schema(description = "新增 Turn 请求体")
public record AddTurnRequestDTO(
        @Schema(description = "用户输入内容") @NotBlank String content,
        @Schema(description = "模型提供商", example = "deepseek") @NotBlank String provider,
        @Schema(description = "模型名称", example = "deepseek-chat") @NotBlank String model) {
}
