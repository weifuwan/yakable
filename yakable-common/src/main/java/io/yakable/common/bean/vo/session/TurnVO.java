package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Turn 展示对象。
 */
@Getter
@Setter
@Schema(description = "Turn 信息")
public class TurnVO {

    @Schema(description = "Turn ID")
    private String id;

    @Schema(description = "Turn 状态")
    private String status;

    @Schema(description = "执行尝试次数")
    private Integer attemptCount;

    @Schema(description = "执行失败信息")
    private String errorMessage;

    @Schema(description = "模型调用信息")
    private TurnInvocationVO invocation;

    @Schema(description = "开始执行时间")
    private LocalDateTime startedAt;

    @Schema(description = "执行完成时间")
    private LocalDateTime finishedAt;

    @Schema(description = "执行耗时，单位毫秒")
    private Long durationMs;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "最后更新时间")
    private LocalDateTime updatedAt;
}
