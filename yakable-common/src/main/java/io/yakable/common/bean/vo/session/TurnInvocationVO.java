package io.yakable.common.bean.vo.session;

import lombok.Getter;
import lombok.Setter;

/**
 * Turn 模型调用信息。
 */
@Getter
@Setter
public class TurnInvocationVO {

    private String provider;
    private String model;
    private TokenUsageVO usage;
    private String providerRequestId;
    private String finishReason;
}
