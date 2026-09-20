package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Session 初始化结果。
 */
@Getter
@Setter
public class SessionInitVO {

    private String sessionId;
    private LocalDateTime updatedAt;
    private String turnId;
}
