package io.yakable.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Project 状态。
 */
@Getter
@AllArgsConstructor
public enum ProjectStatusEnum {

    CREATED(0);

    private final Integer value;

    public static ProjectStatusEnum fromValue(Integer value) {
        for (ProjectStatusEnum item : values()) {
            if (item.value.equals(value)) {
                return item;
            }
        }
        throw new IllegalArgumentException("Unknown project status: " + value);
    }
}
