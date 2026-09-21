package io.yakable.service.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.vo.project.ProjectListVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Project 业务服务。
 */
public interface ProjectService {

    /**
     * 新增 Project，并同步创建首个 Session 和首轮 Turn。
     */
    ProjectListVO addProject(@NotNull @Valid AddProjectDTO dto);

    /**
     * 分页查询当前用户 Project。
     */
    PageData<ProjectListVO> queryProject(@NotNull @Valid QueryProjectPageDTO dto);
}
