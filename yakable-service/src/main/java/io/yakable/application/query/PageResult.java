package io.yakable.application.query;

import java.util.List;
import java.util.Objects;

public record PageResult<T>(
        List<T> records,
        long total,
        long pages,
        int current,
        int pageSize
) {

    public PageResult {
        records = List.copyOf(
                Objects.requireNonNull(records, "records")
        );
        if (total < 0) {
            throw new IllegalArgumentException(
                    "total must not be negative"
            );
        }
        if (pages < 0) {
            throw new IllegalArgumentException(
                    "pages must not be negative"
            );
        }
        if (current <= 0) {
            throw new IllegalArgumentException(
                    "current must be greater than zero"
            );
        }
        if (pageSize <= 0) {
            throw new IllegalArgumentException(
                    "pageSize must be greater than zero"
            );
        }
    }

    public static long pages(long total, int pageSize) {
        if (total == 0) {
            return 0;
        }
        return (total + pageSize - 1L) / pageSize;
    }
}
