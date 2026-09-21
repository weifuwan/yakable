package io.yakable.common.bean.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import io.yakable.common.bean.dto.common.PageDTO;
import io.yakable.common.enums.user.UserRoleEnum;
import io.yakable.common.enums.user.UserStatusEnum;
import lombok.Getter;
import lombok.Setter;

/**
 * 分页查询用户参数。
 */
@Getter
@Setter
@Schema(description = "分页查询用户参数")
public class QueryUserPageDTO extends PageDTO {

    @Schema(description = "用户名、名称或邮箱关键词")
    private String keyword;

    @Schema(description = "用户角色")
    private UserRoleEnum role;

    @Schema(description = "用户状态")
    private UserStatusEnum status;

    public QueryUserPageDTO() {
        setCurrent(1);
        setPageSize(20);
    }
}
