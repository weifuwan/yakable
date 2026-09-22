# Provider Runtime

## 能力

把 Yakable 稳定的 LLM Contract 转换成具体 Provider 调用。

## 边界

Yakable Service 只依赖：

```text
LlmClient
LlmProvider
LlmRequest
LlmStreamEvent
LlmModelMetadata
```

具体 Provider、鉴权和 HTTP 协议留在 Model Plugin。

Service 不能写 DeepSeek / OpenAI 等 Provider 特例。

## 流程

```text
SessionService
→ PluginLlmClient
→ require Provider
→ LlmProvider
→ Model Plugin
→ provider HTTP API
→ LlmStreamEvent
→ Conversation Streaming
```

Context Metadata 同样由 Provider 提供。

## 代码

Stable contract：

```text
yakable-core/src/main/java/io/yakable/core/llm/
```

Runtime bridge：

```text
yakable-service/src/main/java/io/yakable/service/llm/PluginLlmClient.java
```

Plugins：

```text
yakable-plugins/yakable-plugin-model/
├── yakable-plugin-model-api/
├── yakable-plugin-model-openai-compatible/
└── yakable-plugin-model-deepseek/
```

## 测试

Provider 测试不依赖真实生产 Conversation。

重点保护：

- plugin discovery。
- configuration。
- request translation。
- streaming event translation。
- model metadata。
- provider error mapping。

## 依赖

被 Conversation [Streaming](../../conversation/streaming/) 和 [Context](../../conversation/context/) 使用。
