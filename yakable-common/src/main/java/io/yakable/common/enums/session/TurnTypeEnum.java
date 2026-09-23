package io.yakable.common.enums.session;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Turn 执行类型。
 */
@Getter
@AllArgsConstructor
public enum TurnTypeEnum {

    CHAT(0),
    PROJECT_GENERATION(1);

    @EnumValue
    private final Integer value;
}
