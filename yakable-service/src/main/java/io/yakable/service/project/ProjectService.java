package io.yakable.service.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectDTO;
import io.yakable.common.bean.vo.project.ProjectDetailVO;
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
    ProjectDetailVO addProject(@NotNull @Valid AddProjectDTO dto);

    /**
     * 分页查询 Project。
     */
    PageData<ProjectListVO> queryProject(@NotNull @Valid PageDTO dto);

    /**
     * 根据 Project ID 查询详情。
     */
    ProjectDetailVO queryProject(@NotNull @Valid QueryProjectDTO dto);
}
