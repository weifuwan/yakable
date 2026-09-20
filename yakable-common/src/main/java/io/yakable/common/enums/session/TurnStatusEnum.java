package io.yakable.common.enums.session;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Turn 状态。
 */
@Getter
@AllArgsConstructor
public enum TurnStatusEnum {

    PENDING(0),
    RUNNING(1),
    SUCCEEDED(2),
    FAILED(3);

    @EnumValue
    private final Integer value;
}
