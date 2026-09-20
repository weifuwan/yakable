package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

/**
 * Token 使用信息。
 */
@Getter
@Setter
public class TokenUsageVO {

    private Long inputTokens;
    private Long outputTokens;
    private Long totalTokens;
}
