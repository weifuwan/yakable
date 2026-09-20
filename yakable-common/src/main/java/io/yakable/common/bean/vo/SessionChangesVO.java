package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 增量变化返回对象。
 */
@Getter
@Setter
public class SessionChangesVO {

    private TurnVO latestTurn;
    private List<MessageVO> messages;
    private long latestSequence;
}
