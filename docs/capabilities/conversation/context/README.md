# Context

## 能力

决定当前 Turn 调用模型时，哪些 Session 历史能够进入 LLM 输入，以及如何控制 Token Budget。

## 用户行为

Context 对用户大部分时间不可见。

用户应得到两个稳定结果：

- 长 Session 不需要手动清空历史。
- 当前 Prompt 不会为了塞历史而被静默截断。

## 边界

只使用当前 Session。

可进入历史：

```text
SUCCEEDED + 完整 USER / ASSISTANT
STOPPED + 非空 ASSISTANT
```

排除：

```text
FAILED
PENDING
RUNNING
```

当前 Prompt 始终保留。

如果移除全部历史后仍超出当前模型输入能力，本轮明确失败。

## 流程

```text
execute Turn
→ load current USER Message
→ get model metadata
→ read eligible history from newest to older in bounded batches
→ estimate tokens
→ stop when budget reached
→ build LlmRequest
→ provider
```

UI Message 分页与 LLM Context 是两套独立机制。

## 代码

Backend：

```text
SessionServiceImpl
TurnService
MessageService
PluginLlmClient
yakable-core/src/main/java/io/yakable/core/llm/LlmModelMetadata.java
```

Provider 必须提供确定的 model context metadata。

## 测试

保护：

- SUCCEEDED history included。
- STOPPED partial included。
- FAILED / active Turn excluded。
- newest history 优先。
- Prompt 不静默截断。
- Prompt 本身超限时 provider 不被调用。

## 依赖

依赖 [Model Provider Runtime](../../model/provider-runtime/) 提供模型 Metadata。
