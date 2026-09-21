package io.yakable.common.bean.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 修改当前用户资料参数。
 */
@Getter
@Setter
@Schema(description = "修改当前用户资料参数")
public class UpdateCurrentUserDTO {

    @Schema(hidden = true)
    private String userId;

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
}
