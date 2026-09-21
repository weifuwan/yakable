package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 项目表
 */
@Getter
@Setter
@TableName("yak_project")
public class ProjectEntity extends BaseEntity {

    /**
     * 项目名称
     */
    private String name;

    /**
     * 最近活动 Session ID，仅用于 Recent Projects 查询
     */
    @TableField(exist = false)
    private String latestSessionId;

    /**
     * 最近活动时间，仅用于 Recent Projects 查询
     */
    @TableField(exist = false)
    private LocalDateTime activityTime;
}
