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
@TableName("yak_session")
public class SessionEntity {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("project_id")
    private String projectId;

    private String title;
    private String provider;
    private String model;
    private String status;

    @TableField("created_at")
    private Instant createdAt;

    @TableField("updated_at")
    private Instant updatedAt;
}
