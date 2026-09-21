package io.yakable.common.bean.vo.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * 当前登录用户。
 */
@Getter
@Setter
@Schema(description = "当前登录用户")
public class CurrentUserVO {

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
}
