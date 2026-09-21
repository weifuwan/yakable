package io.yakable.common.enums.user;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 用户状态。
 */
@Getter
@AllArgsConstructor
public enum UserStatusEnum {

    ACTIVE(0),
    DISABLED(1);

    @EnumValue
    private final Integer value;
}
