package io.yakable.service.user;

import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.user.InitializeAdminDTO;
import io.yakable.common.bean.dto.user.QueryUserDTO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * User 业务服务。
 */
public interface UserService {

    /**
     * 校验登录账号并返回当前用户。
     */
    CurrentUserVO authenticateUser(@NotNull @Valid LoginDTO dto);

    /**
     * 查询可用用户。
     */
    CurrentUserVO queryActiveUser(@NotNull @Valid QueryUserDTO dto);

    /**
     * 系统无用户时初始化首个管理员。
     */
    void initializeAdmin(@NotNull @Valid InitializeAdminDTO dto);
}
