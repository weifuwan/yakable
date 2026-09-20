package io.yakable.common.bean.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 查询单个 Project 入参。
 *
 * @param projectId Project ID
 */
public record QueryProjectDTO(@NotBlank String projectId) {
}
