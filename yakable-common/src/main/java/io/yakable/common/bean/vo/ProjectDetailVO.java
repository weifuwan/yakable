package io.yakable.common.bean.vo;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Project 详情页面返回对象。
 */
@Getter
@Setter
public class ProjectDetailVO {

    private String id;
    private String name;
    private String latestSessionId;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
