package io.yakable.common.bean.vo.project;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Project 已发布文件列表。
 *
 * @param files Project Root 内规范化相对路径
 */
@Schema(description = "Project 已发布文件列表")
public record ProjectFilesVO(
        @Schema(description = "Project Root 内规范化相对路径") List<String> files) {

    public ProjectFilesVO {
        files = List.copyOf(files);
    }
}
