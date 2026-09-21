package io.yakable.common.bean.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import io.yakable.common.enums.user.UserStatusEnum;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * 修改用户状态参数。
 */
@Getter
@Setter
@Schema(description = "修改用户状态参数")
public class UpdateUserStatusDTO {

    @Schema(hidden = true)
    private String userId;

    @Schema(hidden = true)
    private String operatorId;

    @Schema(description = "目标状态")
    @NotNull
    private UserStatusEnum status;
}
