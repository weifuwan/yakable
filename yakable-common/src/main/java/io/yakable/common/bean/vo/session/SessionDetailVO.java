package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 详情返回对象。
 */
@Getter
@Setter
@Schema(description = "Session 详情")
public class SessionDetailVO {

    @Schema(description = "Session 基本信息")
    private SessionVO session;

    @Schema(description = "Turn 列表")
    private List<TurnVO> turns;

    @Schema(description = "最近 Message 列表")
    private List<MessageVO> messages;

    @Schema(description = "更早 Message 的游标")
    private Long nextBeforeSequence;

    @Schema(description = "是否还有更早 Message")
    private boolean hasMoreMessages;
}
