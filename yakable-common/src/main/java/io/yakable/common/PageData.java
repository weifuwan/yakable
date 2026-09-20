package io.yakable.common;

import java.util.List;

/**
 * 通用分页数据。
 *
 * <p>分页结构属于跨业务公共能力，Service 不再重复定义 XxxPage。</p>
 *
 * @param records 当前页数据
 * @param total 总数据量
 * @param pages 总页数
 * @param current 当前页
 * @param pageSize 每页数量
 * @param <T> 数据类型
 */
public record PageData<T>(
        List<T> records,
        long total,
        long pages,
        int current,
        int pageSize
) {

    public PageData {
        records = records == null ? List.of() : List.copyOf(records);
    }

    /**
     * 根据总数据量和分页参数创建分页结果。
     */
    public static <T> PageData<T> of(
            List<T> records,
            long total,
            int current,
            int pageSize
    ) {
        long pages = total == 0
                ? 0
                : (total + pageSize - 1) / pageSize;

        return new PageData<>(
                records,
                total,
                pages,
                current,
                pageSize
        );
    }
}
