package io.yakable.dao.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.enums.session.TurnTypeEnum;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 执行轮次表
 */
@Getter
@Setter
@TableName("yak_turn")
public class TurnEntity extends BaseEntity {

    /**
     * 所属会话ID
     */
    private String sessionId;

    /**
     * 客户端创建请求ID
     */
    private String requestId;

    /**
     * 执行轮次类型：0-普通会话，1-项目代码生成
     */
    private TurnTypeEnum turnType;

    /**
     * 执行轮次状态：0-待执行，1-执行中，2-成功，3-失败，4-已停止
     */
    private TurnStatusEnum status;

    /**
     * 执行尝试次数
     */
    private Integer attemptCount;

    /**
     * 执行失败信息
     */
    private String errorMessage;

    /**
     * 本轮模型提供商
     */
    private String provider;

    /**
     * 本轮模型名称
     */
    private String model;

    /**
     * 输入Token数量
     */
    private Long inputTokens;

    /**
     * 输出Token数量
     */
    private Long outputTokens;

    /**
     * 总Token数量
     */
    private Long totalTokens;

    /**
     * 模型提供商请求ID
     */
    private String providerRequestId;

    /**
     * 模型调用结束原因
     */
    private String finishReason;

    /**
     * 开始执行时间
     */
    private LocalDateTime startedAt;

    /**
     * 执行完成时间
     */
    private LocalDateTime finishedAt;
}
