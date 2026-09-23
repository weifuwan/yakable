package io.yakable.core.project.generation;

import io.yakable.core.llm.LlmUsage;

import java.util.Objects;

/**
 * Project Code Generation 执行结果。
 *
 * @param project 结构化 Project 结果
 * @param usage Token 使用量
 * @param providerRequestId Provider 请求 ID
 * @param finishReason 模型结束原因
 */
public record ProjectCodeGenerationResult(
        GeneratedProject project,
        LlmUsage usage,
        String providerRequestId,
        String finishReason) {

    public ProjectCodeGenerationResult {
        Objects.requireNonNull(project, "project");
        usage = usage == null ? new LlmUsage(null, null, null) : usage;
    }
}
