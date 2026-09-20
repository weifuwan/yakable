package io.yakable.common.bean.vo.project;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Project 列表页面返回对象。
 */
@Getter
@Setter
public class ProjectListVO {

    private String id;
    private String name;
    private String latestSessionId;
    private LocalDateTime updatedAt;
}
