package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 目标消息窗口返回对象。
 */
@Getter
@Setter
@Schema(description = "Session 目标消息窗口")
public class SessionMessageWindowVO {

    @Schema(description = "Message 列表")
    private List<MessageVO> messages;

    @Schema(description = "是否存在更早 Message")
    private boolean hasOlder;

    @Schema(description = "是否存在更新 Message")
    private boolean hasNewer;

    @Schema(description = "继续向前定位的窗口边界 Message 序号")
    private Long olderCursor;

    @Schema(description = "继续向后定位的窗口边界 Message 序号")
    private Long newerCursor;
}
