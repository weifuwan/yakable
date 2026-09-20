package io.yakable.common.bean.vo.session;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 消息分页返回对象。
 */
@Getter
@Setter
public class SessionMessagePageVO {

    private List<MessageVO> messages;
    private Long nextBeforeSequence;
    private boolean hasMore;
}
