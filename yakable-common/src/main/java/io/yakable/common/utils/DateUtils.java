package io.yakable.common.utils;

import io.yakable.common.exception.BusinessException;
import org.apache.commons.lang3.StringUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * LocalDateTime 时间处理工具。
 */
public final class DateUtils {

    public static final String DEFAULT_PATTERN = "yyyy-MM-dd HH:mm:ss";

    private static final DateTimeFormatter DEFAULT_FORMATTER =
            DateTimeFormatter.ofPattern(DEFAULT_PATTERN);

    private DateUtils() {
    }

    /**
     * 获取当前时间。
     */
    public static LocalDateTime now() {
        return LocalDateTime.now();
    }

    /**
     * 使用默认格式格式化时间。
     */
    public static String format(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.format(DEFAULT_FORMATTER);
    }

    /**
     * 使用指定格式格式化时间。
     */
    public static String format(LocalDateTime dateTime, String pattern) {
        if (dateTime == null) {
            return null;
        }
        return dateTime.format(formatter(pattern));
    }

    /**
     * 使用默认格式解析时间。
     */
    public static LocalDateTime parse(String value) {
        if (StringUtils.isBlank(value)) {
            return null;
        }

        try {
            return LocalDateTime.parse(StringUtils.strip(value), DEFAULT_FORMATTER);
        } catch (DateTimeParseException exception) {
            throw new BusinessException("Failed to parse date: " + value, exception);
        }
    }

    /**
     * 使用指定格式解析时间。
     */
    public static LocalDateTime parse(String value, String pattern) {
        if (StringUtils.isBlank(value)) {
            return null;
        }

        try {
            return LocalDateTime.parse(StringUtils.strip(value), formatter(pattern));
        } catch (DateTimeParseException exception) {
            throw new BusinessException("Failed to parse date: " + value, exception);
        }
    }

    /**
     * 将 Instant 转换为 LocalDateTime。
     */
    public static LocalDateTime toLocalDateTime(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }

    /**
     * 将 LocalDateTime 转换为 Instant。
     */
    public static Instant toInstant(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.atZone(ZoneId.systemDefault()).toInstant();
    }

    private static DateTimeFormatter formatter(String pattern) {
        if (StringUtils.isBlank(pattern)) {
            throw new BusinessException("date pattern must not be blank");
        }

        try {
            return DateTimeFormatter.ofPattern(pattern);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("Invalid date pattern: " + pattern, exception);
        }
    }
}
