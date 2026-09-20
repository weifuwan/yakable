package io.yakable.common.bean.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 分页查询 Project 入参。
 *
 * @param current 当前页
 * @param pageSize 每页数量
 */
public record QueryProjectPageDTO(
        @Min(1) int current,
        @Min(1) @Max(100) int pageSize
) {
}
