package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.session.SessionStatusEnum;
import lombok.Getter;
import lombok.Setter;

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
     * 会话状态：0-活跃，1-已关闭
     */
    private SessionStatusEnum status;
}
