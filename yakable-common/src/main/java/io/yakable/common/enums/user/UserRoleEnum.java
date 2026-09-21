package io.yakable.common.enums.user;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 用户角色。
 */
@Getter
@AllArgsConstructor
public enum UserRoleEnum {

    ADMIN(0),
    USER(1);

    @EnumValue
    private final Integer value;
}
