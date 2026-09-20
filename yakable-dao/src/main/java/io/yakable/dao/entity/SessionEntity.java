package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.session.SessionStatusEnum;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("yak_session")
public class SessionEntity extends BaseEntity {

    private String projectId;
    private String title;
    private String provider;
    private String model;
    private SessionStatusEnum status;
}
