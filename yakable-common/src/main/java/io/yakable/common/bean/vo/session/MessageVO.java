package io.yakable.common.bean.vo.session;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Message 展示对象。
 */
@Getter
@Setter
@Schema(description = "Session 消息")
public class MessageVO {

    @Schema(description = "Message ID")
    private String id;

    @Schema(description = "所属 Turn ID")
    private String turnId;

    @Schema(description = "消息角色")
    private String role;

    @Schema(description = "消息内容")
    private String content;

    @Schema(description = "消息序号")
    private Long sequence;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
