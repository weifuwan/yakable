package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.ProjectStatusEnum;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("yak_project")
public class ProjectEntity extends BaseEntity {

    private String name;
    private ProjectStatusEnum status;
    private transient String latestSessionId;
}
