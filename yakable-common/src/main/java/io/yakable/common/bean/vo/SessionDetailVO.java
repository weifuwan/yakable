package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Session 详情返回对象。
 */
@Getter
@Setter
public class SessionDetailVO {

    private SessionVO session;
    private List<TurnVO> turns;
    private List<MessageVO> messages;
}
