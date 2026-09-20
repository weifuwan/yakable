package io.yakable.common.enums;

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

    private final Integer value;

    public static TurnStatusEnum fromValue(Integer value) {
        for (TurnStatusEnum item : values()) {
            if (item.value.equals(value)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Unknown turn status: " + value);
    }
}
