package io.yakable.common.bean.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import io.yakable.common.enums.user.UserRoleEnum;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 新增用户参数。
 */
@Getter
@Setter
@Schema(description = "新增用户参数")
public class AddUserDTO {

    @Schema(hidden = true)
    private String operatorId;

    @Schema(description = "用户名")
    @NotBlank
    @Size(max = 64)
    private String username;

    @Schema(description = "用户名称")
    @NotBlank
    @Size(max = 64)
    private String name;

    @Schema(description = "用户邮箱")
    @Email
    @Size(max = 254)
    private String email;

    @Schema(description = "头像地址")
    @Size(max = 512)
    private String avatar;

    @Schema(description = "用户角色，默认 USER")
    private UserRoleEnum role;

    @Schema(description = "初始密码")
    @NotBlank
    @Size(min = 8, max = 64)
    private String password;
}
