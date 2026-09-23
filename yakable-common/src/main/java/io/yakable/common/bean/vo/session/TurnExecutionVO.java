package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import io.yakable.common.enums.session.TurnTypeEnum;
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

    @Schema(description = "客户端请求ID")
    private String requestId;

    @Schema(description = "Turn 执行类型")
    private TurnTypeEnum turnType;

    @Schema(description = "模型提供商")
    private String provider;

    @Schema(description = "模型名称")
    private String model;
}
