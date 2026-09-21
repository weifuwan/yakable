package io.yakable.common.bean.vo.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 用户信息。
 */
@Getter
@Setter
@Schema(description = "用户信息")
public class UserVO {

    @Schema(description = "用户ID")
    private String id;

    @Schema(description = "用户名")
    private String username;

    @Schema(description = "用户名称")
    private String name;

    @Schema(description = "用户邮箱")
    private String email;

    @Schema(description = "头像地址")
    private String avatar;

    @Schema(description = "用户角色")
    private String role;

    @Schema(description = "用户状态")
    private String status;

    @Schema(description = "最近登录时间")
    private LocalDateTime lastLoginAt;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
