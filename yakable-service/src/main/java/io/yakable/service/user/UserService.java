package io.yakable.service.user;

import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.dto.user.*;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.bean.vo.user.UserVO;
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
     * 分页查询用户。
     */
    PageData<UserVO> queryUser(@NotNull @Valid QueryUserPageDTO dto);

    /**
     * 新增用户。
     */
    UserVO addUser(@NotNull @Valid AddUserDTO dto);

    /**
     * 编辑用户。
     */
    UserVO updateUser(@NotNull @Valid UpdateUserDTO dto);

    /**
     * 修改用户状态。
     */
    void updateUserStatus(@NotNull @Valid UpdateUserStatusDTO dto);

    /**
     * 管理员重置用户密码。
     */
    void resetUserPassword(@NotNull @Valid ResetUserPasswordDTO dto);

    /**
     * 修改当前用户资料。
     */
    CurrentUserVO updateCurrentUser(@NotNull @Valid UpdateCurrentUserDTO dto);

    /**
     * 修改当前用户密码。
     */
    void updateCurrentUserPassword(@NotNull @Valid UpdateCurrentUserPasswordDTO dto);

    /**
     * 系统无用户时初始化首个管理员。
     */
    void initializeAdmin(@NotNull @Valid InitializeAdminDTO dto);
}
