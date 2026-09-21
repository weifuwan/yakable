package io.yakable.common.bean.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;
import io.yakable.common.bean.dto.common.PageDTO;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * 分页查询 Project 入参。
 */
@Getter
@Setter
@Schema(description = "分页查询 Project 参数")
public class QueryProjectPageDTO extends PageDTO {

    @Schema(hidden = true)
    @NotBlank
    private String userId;

    public QueryProjectPageDTO(int current, int pageSize, String userId) {
        super(current, pageSize);
        this.userId = userId;
    }
}
