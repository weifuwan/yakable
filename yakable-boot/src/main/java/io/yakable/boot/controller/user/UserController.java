package io.yakable.boot.controller.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.common.Result;
import io.yakable.common.bean.PageData;
import io.yakable.common.bean.dto.user.*;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.common.bean.vo.user.UserVO;
import io.yakable.service.user.UserService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "User", description = "用户管理")
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Resource
    private UserService userService;

    @Operation(summary = "分页查询用户")
    @GetMapping
    public Result<PageData<UserVO>> queryUser(@Valid QueryUserPageDTO dto) {
        return Result.success(userService.queryUser(dto));
    }

    @Operation(summary = "新增用户")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<UserVO> addUser(
            @Valid @RequestBody AddUserDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        dto.setOperatorId(currentUser.getId());
        return Result.success(userService.addUser(dto));
    }

    @Operation(summary = "编辑用户")
    @PutMapping("/{userId}")
    public Result<UserVO> updateUser(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        dto.setUserId(userId);
        dto.setOperatorId(currentUser.getId());
        return Result.success(userService.updateUser(dto));
    }

    @Operation(summary = "修改用户状态")
    @PutMapping("/{userId}/status")
    public Result<Void> updateUserStatus(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserStatusDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        dto.setUserId(userId);
        dto.setOperatorId(currentUser.getId());
        userService.updateUserStatus(dto);
        return Result.success();
    }

    @Operation(summary = "重置用户密码")
    @PutMapping("/{userId}/password")
    public Result<Void> resetUserPassword(
            @PathVariable String userId,
            @Valid @RequestBody ResetUserPasswordDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        dto.setUserId(userId);
        dto.setOperatorId(currentUser.getId());
        userService.resetUserPassword(dto);
        return Result.success();
    }

    @Operation(summary = "修改当前用户资料")
    @PutMapping("/me")
    public Result<CurrentUserVO> updateCurrentUser(
            @Valid @RequestBody UpdateCurrentUserDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        dto.setUserId(currentUser.getId());
        return Result.success(userService.updateCurrentUser(dto));
    }

    @Operation(summary = "修改当前用户密码")
    @PutMapping("/me/password")
    public Result<Void> updateCurrentUserPassword(
            @Valid @RequestBody UpdateCurrentUserPasswordDTO dto,
            @AuthenticationPrincipal CurrentUserVO currentUser) {
        dto.setUserId(currentUser.getId());
        userService.updateCurrentUserPassword(dto);
        return Result.success();
    }
}
