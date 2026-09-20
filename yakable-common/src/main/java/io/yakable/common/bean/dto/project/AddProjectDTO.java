package io.yakable.common.bean.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 新增 Project 入参。
 *
 * @param prompt 用户输入内容
 * @param model 模型配置
 */
@Schema(description = "新增 Project 参数")
public record AddProjectDTO(
        @Schema(description = "用户输入内容") @NotBlank String prompt,
        @Schema(description = "模型配置") @NotNull @Valid ModelDTO model) {

    /**
     * Project 创建时使用的模型配置。
     */
    @Schema(description = "Project 模型配置")
    public record ModelDTO(
            @Schema(description = "模型提供商", example = "deepseek") @NotBlank String provider,
            @Schema(description = "模型名称", example = "deepseek-chat") @NotBlank String model) {}
}
