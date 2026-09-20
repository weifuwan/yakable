package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Message 展示对象。
 */
@Getter
@Setter
public class MessageVO {

    private String id;
    private String turnId;
    private String role;
    private String content;
    private Long sequence;
    private LocalDateTime createdAt;
}
