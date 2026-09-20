package io.yakable.common.bean.dto.common;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 通用分页入参。
 *
 * <p>只有分页参数时直接使用本类；业务查询存在额外筛选条件时继承本类扩展领域字段。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "通用分页参数")
public class PageDTO {

    @Schema(description = "当前页码，从 1 开始", example = "1")
    @Min(1)
    private int current;

    @Schema(description = "每页数量", example = "50")
    @Min(1)
    @Max(100)
    private int pageSize;
}
