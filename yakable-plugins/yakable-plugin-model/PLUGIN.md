# Model Plugin Contract

Model Plugin 负责把具体 Provider 接到 Yakable 的统一 LLM 契约上。

## 边界

LLM 的稳定输入输出不属于 Plugin。

统一契约只定义在：

```text
yakable-core
└── io.yakable.core.llm
```

包括：

```text
LlmClient
LlmProvider
LlmRequest
LlmResponse
LlmMessage
LlmUsage
LlmProviderConfiguration
```

Plugin API 只保留插件元数据、能力描述和插件异常。

## 调用关系

```text
Service
  ↓
LlmClient.chat(LlmRequest)
  ↓
LlmProvider
  ↓
ModelPlugin
  ↓
Protocol Client
  ↓
Provider API
```

Service 不直接依赖 `yakable-plugin-model-api`。

## ModelPlugin

`ModelPlugin` 继承 core 的 `LlmProvider`，并补充插件描述信息：

```java
public interface ModelPlugin extends LlmProvider {

    ModelPluginDescriptor descriptor();
}
```

Provider 实现仍然使用 AutoService：

```java
@AutoService({LlmProvider.class, ModelPlugin.class})
public final class DeepSeekModelPlugin implements ModelPlugin {
    ...
}
```

运行时的统一入口通过 `ServiceLoader<LlmProvider>` 发现 Provider。

## Provider vs Protocol

Provider 不是 Protocol。

```text
DeepSeek ----\
Kimi --------+--> OpenAI-compatible protocol
Qwen --------/
```

Provider Plugin 负责：

```text
Provider identity
Provider defaults
Provider capabilities
```

Protocol 模块负责：

```text
HTTP endpoint
request mapping
response mapping
usage mapping
stream parsing
```

如果多个 Provider 使用同一种协议，不要把相同 HTTP 代码复制到每个 Provider。

## Configuration

Provider 的 API Key、Base URL 等运行时配置不会进入 Service 的 `LlmRequest`。

```text
Service
  ↓
LlmRequest
  ↓
PluginLlmClient
  ↓
LlmProviderConfiguration
  ↓
LlmProvider
```

当前配置：

```yaml
yakable:
  model:
    providers:
      deepseek:
        api-key: ${DEEPSEEK_API_KEY:}
        base-url: ${DEEPSEEK_BASE_URL:https://api.deepseek.com}
```

## 当前不做

```text
Provider Registry API
自动路由
Fallback
Retry
Streaming contract
Tool Call contract
```

先固定非流式 Chat 的内部边界。

## Adding a provider

OpenAI-compatible Provider：

```text
1. 新增 yakable-plugin-model-<provider>
2. 依赖 yakable-plugin-model-api
3. 依赖 yakable-plugin-model-openai-compatible
4. 实现 ModelPlugin
5. 注册 LlmProvider / ModelPlugin
6. 定义 descriptor 和 Provider 默认配置
7. 加入 yakable-plugin-model-all
```

新增 Provider 时，不修改 SessionService 的 LLM 请求响应结构。
