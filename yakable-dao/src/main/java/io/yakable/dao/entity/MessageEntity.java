package io.yakable.dao.session.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

@TableName("yak_message")
public class MessageEntity {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("session_id")
    private String sessionId;

    @TableField("turn_id")
    private String turnId;

    @TableField("role")
    private String role;

    @TableField("content")
    private String content;

    @TableField("message_sequence")
    private Long messageSequence;

    @TableField("created_at")
    private Instant createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getTurnId() {
        return turnId;
    }

    public void setTurnId(String turnId) {
        this.turnId = turnId;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Long getMessageSequence() {
        return messageSequence;
    }

    public void setMessageSequence(Long messageSequence) {
        this.messageSequence = messageSequence;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
