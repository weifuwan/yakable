package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Session 展示对象。
 */
@Getter
@Setter
public class SessionVO {

    private String id;
    private String projectId;
    private String title;
    private SessionModelVO model;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
