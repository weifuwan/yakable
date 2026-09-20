package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.session.MessageRoleEnum;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("yak_message")
public class MessageEntity extends BaseEntity {

    private String sessionId;
    private String turnId;
    private MessageRoleEnum role;
    private String content;
    private Long messageSequence;
}
