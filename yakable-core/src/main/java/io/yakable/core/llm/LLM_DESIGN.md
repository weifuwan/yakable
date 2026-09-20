# LLM 设计说明

适用于：

```text
yakable-core/src/main/java/io/yakable/core/llm
```

## 解决什么问题

Yakable 需要调用不同 Provider，但 Service 不应该关心 DeepSeek、Kimi、OpenAI-compatible 等具体协议。

LLM Core 的目标是固定 Yakable 自己的输入、输出和调用边界，让上层只依赖统一 Contract。

## 设计目标

```text
Service
  ↓
LlmClient
  ↓
LlmProvider
  ↓
Provider / Protocol
```

上层只表达：

```text
调用哪个 Provider
调用哪个 Model
System Prompt
Messages
```

上层不关心：

```text
API Key
Base URL
HTTP Endpoint
鉴权方式
外部 JSON 字段
Provider-specific 协议
```

## 核心 Contract

### LlmClient

Yakable 内部统一入口：

```java
LlmResponse chat(LlmRequest request);
```

Service 只依赖 `LlmClient`。

### LlmRequest

统一输入：

```text
provider
model
system
messages
```

请求只描述一次模型调用需要什么，不承载 Provider 配置。

### LlmResponse

统一输出：

```text
provider
model
content
usage
providerRequestId
finishReason
```

外部 Provider 的原始响应必须先转换为 `LlmResponse`，再返回上层。

### LlmProvider

Provider 统一适配入口：

```java
LlmResponse chat(LlmProviderConfiguration configuration, LlmRequest request);
```

Provider 负责将 Yakable Contract 转换为具体协议，再把外部响应转换回来。

### LlmProviderConfiguration

只承载 Provider 运行时配置，例如：

```text
apiKey
baseUrl
```

配置由运行时装配层提供，不进入业务请求。

## 职责边界

```text
Service
-> 业务编排、上下文组织、结果使用

LlmClient
-> 统一调用入口、Provider 选择

LlmProvider
-> Provider 适配

Protocol Client
-> HTTP、鉴权、JSON、流协议等外部协议细节
```

Core 只定义稳定 Contract，不实现 Spring Bean 装配，也不包含具体 Provider HTTP 逻辑。

## 当前能力

当前只支持：

```text
完整 Request
  ↓
非流式 Chat
  ↓
完整 Response
```

当前统一的是“调用完成后拿到什么”。

## 当前不做

没有真实需求前，不在 Core 提前加入：

```text
Streaming
Tool Call
Retry
Fallback
自动模型路由
Provider Registry API
成本策略
上下文裁剪
```

这些能力出现真实需求后，再基于现有 Contract 单独扩展。

## 扩展原则

新增 Provider：

```text
新增 LlmProvider 实现
-> 适配具体协议
-> 不修改 Service Contract
```

新增 LLM 能力：

```text
先确认新的内部语义
-> 再扩展 Core Contract
-> 最后由 Provider 适配
```

禁止因为某个 Provider 的特殊字段直接修改 Service 调用方式。

## 判断标准

LLM Core 设计是否合理，只看三件事：

1. 换 Provider 时，Service 是否基本不变。
2. 外部协议变化时，变化是否被限制在 Provider / Protocol 层。
3. 新能力没有真实需求时，Core 是否仍保持最小。
