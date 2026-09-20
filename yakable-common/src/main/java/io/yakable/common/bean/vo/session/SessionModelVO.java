package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

/**
 * Session 模型信息。
 */
@Getter
@Setter
@Schema(description = "Session 模型信息")
public class SessionModelVO {

    @Schema(description = "模型提供商", example = "deepseek")
    private String provider;

    @Schema(description = "模型名称", example = "deepseek-chat")
    private String model;
}
