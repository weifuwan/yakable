package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 消息分页返回对象。
 */
@Getter
@Setter
@Schema(description = "Session 消息分页结果")
public class SessionMessagePageVO {

    @Schema(description = "Message 列表")
    private List<MessageVO> messages;

    @Schema(description = "下一页向前查询的 Message 序号")
    private Long nextBeforeSequence;

    @Schema(description = "是否还有更多 Message")
    private boolean hasMore;
}
