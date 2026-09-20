package io.yakable.common.utils;

import io.yakable.common.exception.BusinessException;
import org.springframework.beans.BeanUtils;

import java.util.Collection;
import java.util.List;

/**
 * 通用对象转换工具。
 */
public final class ConverUtils {

    private ConverUtils() {
    }

    /**
     * 将源对象复制为指定目标类型。
     */
    public static <T> T convert(Object source, Class<T> targetClass) {
        if (targetClass == null) {
            throw new BusinessException("targetClass must not be null");
        }
        if (source == null) {
            return null;
        }

        try {
            T target = BeanUtils.instantiateClass(targetClass);
            BeanUtils.copyProperties(source, target);
            return target;
        } catch (RuntimeException exception) {
            String message = "Failed to convert " + source.getClass().getName() + " to " + targetClass.getName();
            throw new BusinessException(message, exception);
        }
    }

    /**
     * 批量转换对象集合。
     */
    public static <T> List<T> convertList(Collection<?> sources, Class<T> targetClass) {
        if (targetClass == null) {
            throw new BusinessException("targetClass must not be null");
        }
        if (sources == null || sources.isEmpty()) {
            return List.of();
        }
        return sources.stream().map(source -> convert(source, targetClass)).toList();
    }
}
