package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

/**
 * Turn 创建结果。
 */
@Getter
@Setter
public class TurnStartVO {

    private TurnVO turn;
    private MessageVO userMessage;
}
