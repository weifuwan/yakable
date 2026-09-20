package io.yakable.common.bean.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 新增 Project 入参。
 *
 * @param prompt 用户输入内容
 * @param model 模型配置
 */
public record AddProjectDTO(@NotBlank String prompt, @NotNull @Valid ModelDTO model) {

    /**
     * Project 创建时使用的模型配置。
     */
    public record ModelDTO(@NotBlank String provider, @NotBlank String model) {}
}
