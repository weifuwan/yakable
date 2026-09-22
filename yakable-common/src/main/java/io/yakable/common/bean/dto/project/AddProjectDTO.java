package io.yakable.common.bean.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import io.yakable.common.constant.MessageConstant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 新增 Project 入参。
 *
 * @param userId 当前用户ID
 * @param prompt 用户输入内容
 * @param model 模型配置
 * @param requestId 客户端请求ID
 */
@Schema(description = "新增 Project 参数")
public record AddProjectDTO(
        @Schema(hidden = true) String userId,
        @Schema(description = "用户输入内容") @NotBlank @Size(max = MessageConstant.MAX_CONTENT_LENGTH) String prompt,
        @Schema(description = "模型配置") @NotNull @Valid ModelDTO model,
        @Schema(description = "客户端请求ID") @NotBlank @Size(max = 64) String requestId) {

    public AddProjectDTO(String prompt, ModelDTO model, String requestId) {
        this(null, prompt, model, requestId);
    }

    /**
     * Project 创建时使用的模型配置。
     */
    @Schema(description = "Project 模型配置")
    public record ModelDTO(
            @Schema(description = "模型提供商", example = "deepseek") @NotBlank String provider,
            @Schema(description = "模型名称", example = "deepseek-chat") @NotBlank String model) {}
}
