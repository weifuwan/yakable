package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * Turn 模型调用信息。
 */
@Getter
@Setter
@Schema(description = "Turn 模型调用信息")
public class TurnInvocationVO {

    @Schema(description = "模型提供商")
    private String provider;

    @Schema(description = "模型名称")
    private String model;

    @Schema(description = "Token 使用信息")
    private TokenUsageVO usage;

    @Schema(description = "模型提供商请求 ID")
    private String providerRequestId;

    @Schema(description = "模型调用结束原因")
    private String finishReason;
}
