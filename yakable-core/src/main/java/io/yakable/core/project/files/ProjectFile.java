package io.yakable.core.project.files;

import java.util.Objects;

/**
 * Project 生成文件。
 *
 * @param path Project Root 内相对路径
 * @param content 完整文件内容
 */
public record ProjectFile(String path, String content) {

    public ProjectFile {
        if (path == null || path.isBlank()) {
            throw new IllegalArgumentException("path must not be blank");
        }
        Objects.requireNonNull(content, "content");
    }
}
