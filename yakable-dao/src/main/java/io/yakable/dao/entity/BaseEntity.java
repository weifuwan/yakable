package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import io.yakable.common.constant.SystemConstant;
import io.yakable.common.utils.DateUtils;
import io.yakable.common.utils.IdUtils;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 数据库实体基础类。
 */
@Getter
@Setter
public abstract class BaseEntity {

    @TableId(type = IdType.INPUT)
    private String id;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField(fill = FieldFill.INSERT)
    private String createBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private String updateBy;

    public void initCreate() {
        initCreate(SystemConstant.SYSTEM_USER);
    }

    public void initCreate(String userId) {
        LocalDateTime now = DateUtils.now();
        if (id == null || id.isBlank()) {
            id = IdUtils.nextId();
        }
        createTime = now;
        updateTime = now;
        createBy = normalizeUser(userId);
        updateBy = createBy;
    }

    public void initUpdate() {
        initUpdate(SystemConstant.SYSTEM_USER);
    }

    public void initUpdate(String userId) {
        updateTime = DateUtils.now();
        updateBy = normalizeUser(userId);
    }

    private static String normalizeUser(String userId) {
        return userId == null || userId.isBlank() ? SystemConstant.SYSTEM_USER : userId.strip();
    }
}
