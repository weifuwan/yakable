package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * Turn 导航索引项。
 */
@Getter
@Setter
@Schema(description = "Turn 导航索引项")
public class TurnNavigationItemVO {

    @Schema(description = "Turn ID")
    private String turnId;

    @Schema(description = "USER Message ID")
    private String userMessageId;

    @Schema(description = "USER Message 序号")
    private Long userMessageSequence;

    @Schema(description = "USER Prompt 预览")
    private String preview;
}
