package io.yakable.common.bean.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 通用分页入参。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PageDTO {

    @Min(1)
    private int current;

    @Min(1)
    @Max(100)
    private int pageSize;
}
