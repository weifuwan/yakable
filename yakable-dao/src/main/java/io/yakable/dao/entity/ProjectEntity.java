package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("yak_project")
public class ProjectEntity extends BaseEntity {

    private String name;
    private Integer status;
    private transient String latestSessionId;
}
