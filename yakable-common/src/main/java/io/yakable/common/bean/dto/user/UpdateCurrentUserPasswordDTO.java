package io.yakable.common.bean.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 修改当前用户密码参数。
 */
@Getter
@Setter
@Schema(description = "修改当前用户密码参数")
public class UpdateCurrentUserPasswordDTO {

    @Schema(hidden = true)
    private String userId;

    @Schema(description = "当前密码")
    @NotBlank
    @Size(max = 64)
    private String currentPassword;

    @Schema(description = "新密码")
    @NotBlank
    @Size(min = 8, max = 64)
    private String newPassword;

    @Schema(description = "确认新密码")
    @NotBlank
    @Size(min = 8, max = 64)
    private String confirmPassword;
}
