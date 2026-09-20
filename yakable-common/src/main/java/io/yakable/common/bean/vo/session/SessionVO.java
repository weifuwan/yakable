package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Session 展示对象。
 */
@Getter
@Setter
@Schema(description = "Session 信息")
public class SessionVO {

    @Schema(description = "Session ID")
    private String id;

    @Schema(description = "Project ID")
    private String projectId;

    @Schema(description = "Session 标题")
    private String title;

    @Schema(description = "模型信息")
    private SessionModelVO model;

    @Schema(description = "Session 状态")
    private String status;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "最后更新时间")
    private LocalDateTime updatedAt;
}
