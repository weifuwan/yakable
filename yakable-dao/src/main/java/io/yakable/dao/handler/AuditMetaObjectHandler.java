package io.yakable.dao.handler;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import io.yakable.common.constant.SystemConstant;
import io.yakable.common.utils.DateUtils;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * MyBatis-Plus 审计字段自动填充。
 */
@Component
public class AuditMetaObjectHandler implements MetaObjectHandler {

    @Override
    public void insertFill(MetaObject metaObject) {
        LocalDateTime now = DateUtils.now();
        strictInsertFill(metaObject, "createTime", LocalDateTime.class, now);
        strictInsertFill(metaObject, "updateTime", LocalDateTime.class, now);
        strictInsertFill(metaObject, "createBy", String.class, SystemConstant.SYSTEM_USER);
        strictInsertFill(metaObject, "updateBy", String.class, SystemConstant.SYSTEM_USER);
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, DateUtils.now());
        strictUpdateFill(metaObject, "updateBy", String.class, SystemConstant.SYSTEM_USER);
    }
}
