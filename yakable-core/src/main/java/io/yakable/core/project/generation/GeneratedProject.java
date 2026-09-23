package io.yakable.core.project.generation;

import io.yakable.common.utils.StringUtils;
import io.yakable.core.project.files.ProjectFile;

import java.util.List;
import java.util.Objects;

/**
 * 一次代码生成得到的完整 Project 结果。
 *
 * @param summary 用户可见的生成摘要
 * @param files 完整项目文件集合
 */
public record GeneratedProject(String summary, List<ProjectFile> files) {

    public GeneratedProject {
        summary = StringUtils.requireStrippedText(summary, "summary");
        Objects.requireNonNull(files, "files");
        files = List.copyOf(files);
        if (files.isEmpty()) {
            throw new IllegalArgumentException("files must not be empty");
        }
    }
}
