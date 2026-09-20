package io.yakable.common.enums;

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

    private final Integer value;

    public static SessionStatusEnum fromValue(Integer value) {
        for (SessionStatusEnum item : values()) {
            if (item.value.equals(value)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Unknown session status: " + value);
    }
}
