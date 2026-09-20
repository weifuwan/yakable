package io.yakable.common;

import org.apache.commons.lang3.StringUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * LocalDateTime 时间处理工具。
 *
 * <p>业务代码统一使用 {@link LocalDateTime}，与旧时间类型或字符串之间的转换统一收口到本类。</p>
 */
public final class DateUtils {

    public static final String DEFAULT_PATTERN = "yyyy-MM-dd HH:mm:ss";

    private static final DateTimeFormatter DEFAULT_FORMATTER =
            DateTimeFormatter.ofPattern(DEFAULT_PATTERN);

    private DateUtils() {
    }

    /**
     * 获取当前本地时间。
     */
    public static LocalDateTime now() {
        return LocalDateTime.now();
    }

    /**
     * 使用默认格式格式化时间。
     */
    public static String format(LocalDateTime dateTime) {
        return dateTime == null
                ? null
                : dateTime.format(DEFAULT_FORMATTER);
    }

    /**
     * 使用指定格式格式化时间。
     */
    public static String format(
            LocalDateTime dateTime,
            String pattern
    ) {
        if (dateTime == null) {
            return null;
        }
        if (StringUtils.isBlank(pattern)) {
            throw new BusinessException("date pattern must not be blank");
        }

        try {
            return dateTime.format(
                    DateTimeFormatter.ofPattern(pattern)
            );
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(
                    "Invalid date pattern: " + pattern,
                    exception
            );
        }
    }

    /**
     * 使用默认格式解析时间。
     */
    public static LocalDateTime parse(String value) {
        return parse(value, DEFAULT_PATTERN);
    }

    /**
     * 使用指定格式解析时间。
     */
    public static LocalDateTime parse(
            String value,
            String pattern
    ) {
        if (StringUtils.isBlank(value)) {
            return null;
        }
        if (StringUtils.isBlank(pattern)) {
            throw new BusinessException("date pattern must not be blank");
        }

        try {
            return LocalDateTime.parse(
                    StringUtils.strip(value),
                    DateTimeFormatter.ofPattern(pattern)
            );
        } catch (DateTimeParseException | IllegalArgumentException exception) {
            throw new BusinessException(
                    "Failed to parse date: " + value,
                    exception
            );
        }
    }

    /**
     * 将 Instant 转换为系统默认时区下的 LocalDateTime。
     */
    public static LocalDateTime toLocalDateTime(Instant instant) {
        return toLocalDateTime(instant, ZoneId.systemDefault());
    }

    /**
     * 将 Instant 转换为指定时区下的 LocalDateTime。
     */
    public static LocalDateTime toLocalDateTime(
            Instant instant,
            ZoneId zoneId
    ) {
        if (instant == null) {
            return null;
        }
        if (zoneId == null) {
            throw new BusinessException("zoneId must not be null");
        }
        return LocalDateTime.ofInstant(instant, zoneId);
    }

    /**
     * 将 LocalDateTime 转换为系统默认时区下的 Instant。
     */
    public static Instant toInstant(LocalDateTime dateTime) {
        return toInstant(dateTime, ZoneId.systemDefault());
    }

    /**
     * 将 LocalDateTime 转换为指定时区下的 Instant。
     */
    public static Instant toInstant(
            LocalDateTime dateTime,
            ZoneId zoneId
    ) {
        if (dateTime == null) {
            return null;
        }
        if (zoneId == null) {
            throw new BusinessException("zoneId must not be null");
        }
        return dateTime.atZone(zoneId).toInstant();
    }
}
