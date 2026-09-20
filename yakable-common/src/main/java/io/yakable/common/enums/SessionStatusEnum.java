package io.yakable.common.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Session 状态。
 */
@Getter
@AllArgsConstructor
public enum SessionStatusEnum {

    ACTIVE(0),
    CLOSED(1);

    @EnumValue
    private final Integer value;
}
