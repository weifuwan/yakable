package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Session 初始化结果。
 */
@Getter
@Setter
@Schema(description = "Session 初始化结果")
public class SessionInitVO {

    @Schema(description = "Session ID")
    private String sessionId;

    @Schema(description = "Session 最后更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "首个 Turn ID")
    private String turnId;
}
