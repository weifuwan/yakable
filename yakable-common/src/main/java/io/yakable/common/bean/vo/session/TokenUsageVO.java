package io.yakable.common.bean.vo.session;

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
