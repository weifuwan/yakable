package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * Turn 执行上下文。
 */
@Getter
@Setter
@Schema(description = "Turn 执行上下文")
public class TurnExecutionVO {

    @Schema(description = "Turn ID")
    private String id;

    @Schema(description = "Session ID")
    private String sessionId;
}
