package io.yakable.common.enums;

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

    private final Integer value;

    public static MessageRoleEnum fromValue(Integer value) {
        for (MessageRoleEnum item : values()) {
            if (item.value.equals(value)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Unknown message role: " + value);
    }
}
