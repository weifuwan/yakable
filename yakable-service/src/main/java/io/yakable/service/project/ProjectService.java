package io.yakable.service.project;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.project.AddProjectDTO;
import io.yakable.common.bean.dto.project.QueryProjectFileDTO;
import io.yakable.common.bean.dto.project.QueryProjectFilesDTO;
import io.yakable.common.bean.dto.project.QueryProjectPageDTO;
import io.yakable.common.bean.vo.project.ProjectFileVO;
import io.yakable.common.bean.vo.project.ProjectFilesVO;
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

    /**
     * 查询当前用户 Project 已发布文件列表。
     */
    ProjectFilesVO queryProjectFiles(@NotNull @Valid QueryProjectFilesDTO dto);

    /**
     * 查询当前用户 Project 单个已发布文件。
     */
    ProjectFileVO queryProjectFile(@NotNull @Valid QueryProjectFileDTO dto);
}
