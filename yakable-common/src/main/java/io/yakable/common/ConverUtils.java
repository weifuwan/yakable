package io.yakable.common;

import org.springframework.beans.BeanUtils;

import java.util.Collection;
import java.util.List;

/**
 * 通用对象转换工具。
 *
 * <p>统一处理同名属性对象之间的转换，避免业务代码重复创建目标对象并逐个复制属性。</p>
 */
public final class ConverUtils {

    private ConverUtils() {
    }

    /**
     * 将源对象转换为指定目标类型。
     *
     * @param source 源对象
     * @param targetClass 目标类型
     * @param <T> 目标对象类型
     * @return 转换后的目标对象；源对象为 {@code null} 时返回 {@code null}
     */
    public static <T> T convert(Object source, Class<T> targetClass) {
        if (source == null) {
            return null;
        }
        if (targetClass == null) {
            throw new BusinessException("targetClass must not be null");
        }

        try {
            T target = BeanUtils.instantiateClass(targetClass);
            BeanUtils.copyProperties(source, target);
            return target;
        } catch (RuntimeException exception) {
            throw new BusinessException(
                    "Failed to convert "
                            + source.getClass().getName()
                            + " to "
                            + targetClass.getName(),
                    exception
            );
        }
    }

    /**
     * 批量转换对象集合。
     *
     * @param sources 源对象集合
     * @param targetClass 目标类型
     * @param <T> 目标对象类型
     * @return 转换后的对象列表
     */
    public static <T> List<T> convertList(
            Collection<?> sources,
            Class<T> targetClass
    ) {
        if (sources == null || sources.isEmpty()) {
            return List.of();
        }

        return sources.stream()
                .map(source -> convert(source, targetClass))
                .toList();
    }
}
