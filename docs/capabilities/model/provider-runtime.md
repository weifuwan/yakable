# Provider Runtime

Status: Done
Domain: Model

Depends On:
- None

Related:
- [Model Selection](./selection.md)
- [Streaming](../conversation/streaming.md)
- [Context](../conversation/context.md)

Frontend:
- None

Backend:
- `yakable-core/src/main/java/io/yakable/core/llm/LlmClient.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmProvider.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmRequest.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmStreamEvent.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmModelMetadata.java`
- `yakable-service/src/main/java/io/yakable/service/llm/PluginLlmClient.java`
- `yakable-plugins/yakable-plugin-model/yakable-plugin-model-api/src/main/java/io/yakable/plugin/model/api/ModelPlugin.java`
- `yakable-plugins/yakable-plugin-model/yakable-plugin-model-deepseek/src/main/java/io/yakable/plugin/model/deepseek/DeepSeekModelPlugin.java`
- `yakable-plugins/yakable-plugin-model/yakable-plugin-model-openai-compatible/src/main/java/io/yakable/plugin/model/openai/OpenAiCompatibleClient.java`

Data:
- LlmRequest
- LlmStreamEvent
- LlmModelMetadata
- Provider Configuration

Shared Rules:
- MODEL-001
- MODEL-002
- MODEL-004
- MODEL-005
- MODEL-006

Scenarios:
- MODEL-S01
- MODEL-S02

Tests:
- `yakable-core/src/test/java/io/yakable/core/llm/LlmModelMetadataTest.java`
- `yakable-plugins/yakable-plugin-model/yakable-plugin-model-deepseek/src/test/java/io/yakable/plugin/model/deepseek/DeepSeekModelPluginTest.java`
- `yakable-plugins/yakable-plugin-model/yakable-plugin-model-openai-compatible/src/test/java/io/yakable/plugin/model/openai/OpenAiCompatibleClientTest.java`

## Purpose

把 Yakable 稳定的 LLM Contract 转换成具体 Provider 调用。

## Contract

- 业务 Service 只依赖 LlmClient / LlmProvider 等稳定 Contract。
- Service 不写 DeepSeek / OpenAI 等 Provider 特例。
- Provider 鉴权、HTTP 协议和协议差异留在 Plugin。
- Provider 把原始响应翻译成统一 LlmStreamEvent。
- Provider 必须提供当前支持模型的 LlmModelMetadata。
- 配置缺失或 Provider 不存在时明确失败。

## Flow

```text
Conversation
→ PluginLlmClient
→ resolve LlmProvider
→ Provider configuration
→ Model Plugin
→ provider HTTP API
→ LlmStreamEvent
→ Conversation Streaming
```

## Boundary

Owns:
- provider discovery
- provider configuration
- request / response protocol translation
- model metadata

Does Not Own:
- product model selection
- Conversation state machine
- UI Streaming
