package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("yak_message")
public class MessageEntity {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("session_id")
    private String sessionId;

    @TableField("turn_id")
    private String turnId;

    private String role;
    private String content;

    @TableField("message_sequence")
    private Long messageSequence;

    @TableField("created_at")
    private Instant createdAt;
}
