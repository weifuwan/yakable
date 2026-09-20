# yakable-core

`yakable-core` 放 Yakable 自己定义的稳定运行时契约。

它不负责 Controller、业务编排、数据库访问，也不放具体 Provider 实现。

## LLM

核心问题：

> Service 能不能只依赖 Yakable 自己的 LLM 协议，而不依赖 DeepSeek、Kimi 或 Plugin 的请求响应结构？

固定入口：

```java
LlmResponse response = llmClient.chat(request);
```

固定输入：

```text
LlmRequest
├── provider
├── model
├── system
└── messages
```

固定输出：

```text
LlmResponse
├── provider
├── model
├── content
├── usage
├── providerRequestId
└── finishReason
```

Provider 统一实现：

```java
LlmResponse chat(LlmProviderConfiguration configuration, LlmRequest request);
```

调用关系：

```text
Service
  ↓
LlmClient.chat(request)
  ↓
LlmProvider
  ↓
DeepSeek / Kimi / ...
```

Service 不认识：

```text
API Key
Base URL
/chat/completions
choices[0].message.content
prompt_tokens
completion_tokens
```

这些差异由 Provider / Protocol 层处理。

## 当前只做什么

当前只固定非流式 Chat：

```text
Request
  ↓
完整 Response
```

暂不增加：

```text
Streaming
Tool Call
Provider Registry API
Fallback
Retry
自动模型路由
```

复杂度真实出现以后，再继续扩展这套 core contract。
