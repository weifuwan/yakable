package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * Turn 创建结果。
 */
@Getter
@Setter
@Schema(description = "Turn 创建结果")
public class TurnStartVO {

    @Schema(description = "创建的 Turn")
    private TurnVO turn;

    @Schema(description = "用户 Message")
    private MessageVO userMessage;
}
