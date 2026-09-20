package io.yakable.common.bean.vo.project;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Project 列表页面返回对象。
 */
@Getter
@Setter
@Schema(description = "Project 列表项")
public class ProjectListVO {

    @Schema(description = "Project ID")
    private String id;

    @Schema(description = "Project 名称")
    private String name;

    @Schema(description = "最新 Session ID")
    private String latestSessionId;

    @Schema(description = "最后更新时间")
    private LocalDateTime updatedAt;
}
