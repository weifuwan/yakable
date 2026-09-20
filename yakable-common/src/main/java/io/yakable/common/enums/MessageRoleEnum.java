package io.yakable.common.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Message 角色。
 */
@Getter
@AllArgsConstructor
public enum MessageRoleEnum {

    USER(0),
    ASSISTANT(1),
    SYSTEM(2);

    @EnumValue
    private final Integer value;
}
