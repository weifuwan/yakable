package io.yakable.common.bean.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 管理员重置用户密码参数。
 */
@Getter
@Setter
@Schema(description = "重置用户密码参数")
public class ResetUserPasswordDTO {

    @Schema(hidden = true)
    private String userId;

    @Schema(hidden = true)
    private String operatorId;

    @Schema(description = "新密码")
    @NotBlank
    @Size(min = 8, max = 64)
    private String newPassword;

    @Schema(description = "确认新密码")
    @NotBlank
    @Size(min = 8, max = 64)
    private String confirmPassword;
}
