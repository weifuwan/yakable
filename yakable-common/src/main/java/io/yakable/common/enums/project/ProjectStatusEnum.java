package io.yakable.common.enums.project;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Project 状态。
 */
@Getter
@AllArgsConstructor
public enum ProjectStatusEnum {

    CREATED(0);

    @EnumValue
    private final Integer value;
}
