package io.yakable.common.bean.vo.project;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Project 已发布文本文件。
 *
 * @param path Project Root 内规范化相对路径
 * @param content 完整文本内容
 */
@Schema(description = "Project 已发布文本文件")
public record ProjectFileVO(
        @Schema(description = "Project Root 内规范化相对路径") String path,
        @Schema(description = "完整文本内容") String content) {
}
