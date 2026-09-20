package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.project.ProjectStatusEnum;
import lombok.Getter;
import lombok.Setter;

/**
 * 项目表
 */
@Getter
@Setter
@TableName("yak_project")
public class ProjectEntity extends BaseEntity {

    /**
     * 项目名称
     */
    private String name;

    /**
     * 项目状态：0-已创建
     */
    private ProjectStatusEnum status;
}
