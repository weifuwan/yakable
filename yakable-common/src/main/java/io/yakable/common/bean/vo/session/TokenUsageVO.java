package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * Token 使用信息。
 */
@Getter
@Setter
@Schema(description = "Token 使用信息")
public class TokenUsageVO {

    @Schema(description = "输入 Token 数")
    private Long inputTokens;

    @Schema(description = "输出 Token 数")
    private Long outputTokens;

    @Schema(description = "总 Token 数")
    private Long totalTokens;
}
