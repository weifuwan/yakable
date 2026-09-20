package io.yakable.common.utils;

import lombok.experimental.UtilityClass;

import java.util.Locale;
import java.util.Objects;

/**
 * 字符串公共处理工具。
 */
@UtilityClass
public class StringUtils {

    /**
     * 校验字符串不能为空，保留原始值。
     */
    public String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        if (isBlank(value)) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }

    /**
     * 校验字符串不能为空，并去除首尾空白。
     */
    public String requireStrippedText(String value, String field) {
        return requireText(value, field).strip();
    }

    /**
     * 判断字符串是否为空白。
     */
    public boolean isBlank(String value) {
        return org.apache.commons.lang3.StringUtils.isBlank(value);
    }

    /**
     * 去除首尾空白，null 返回空字符串。
     */
    public String stripToEmpty(String value) {
        return value == null ? "" : value.strip();
    }

    /**
     * 去除首尾空白，空白字符串返回 null。
     */
    public String stripToNull(String value) {
        return org.apache.commons.lang3.StringUtils.stripToNull(value);
    }

    /**
     * 规范化不区分大小写的标识。
     */
    public String normalizeKey(String value, String field) {
        return requireStrippedText(value, field).toLowerCase(Locale.ROOT);
    }

    /**
     * 去除字符串末尾的斜杠。
     */
    public String stripTrailingSlash(String value) {
        return org.apache.commons.lang3.StringUtils.stripEnd(stripToEmpty(value), "/");
    }
}
