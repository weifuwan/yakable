package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 会话表
 */
@Getter
@Setter
@TableName("yak_session")
public class SessionEntity extends BaseEntity {

    /**
     * 所属项目ID
     */
    private String projectId;

    /**
     * 会话标题
     */
    private String title;

    /**
     * 模型提供商
     */
    private String provider;

    /**
     * 模型名称
     */
    private String model;

    /**
     * 最近用户交互时间
     */
    private LocalDateTime activityTime;
}
