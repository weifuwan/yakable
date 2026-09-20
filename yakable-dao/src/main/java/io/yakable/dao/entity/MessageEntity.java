package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.session.MessageRoleEnum;
import lombok.Getter;
import lombok.Setter;

/**
 * 会话消息表
 */
@Getter
@Setter
@TableName("yak_message")
public class MessageEntity extends BaseEntity {

    /**
     * 所属会话ID
     */
    private String sessionId;

    /**
     * 所属执行轮次ID
     */
    private String turnId;

    /**
     * 消息角色：0-用户，1-助手，2-系统
     */
    private MessageRoleEnum role;

    /**
     * 消息内容
     */
    private String content;

    /**
     * 会话内消息序号
     */
    private Long messageSequence;
}
