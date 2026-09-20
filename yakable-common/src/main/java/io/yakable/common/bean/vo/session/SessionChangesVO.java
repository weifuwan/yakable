package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 增量变化返回对象。
 */
@Getter
@Setter
@Schema(description = "Session 增量变化")
public class SessionChangesVO {

    @Schema(description = "最新 Turn")
    private TurnVO latestTurn;

    @Schema(description = "新增 Message 列表")
    private List<MessageVO> messages;

    @Schema(description = "最新 Message 序号")
    private long latestSequence;
}
