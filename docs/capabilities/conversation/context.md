# Context

Status: Done
Domain: Conversation

Depends On:
- [Provider Runtime](../model/provider-runtime.md)

Related:
- [History](./history.md)
- [Stop](./stop.md)
- [Send Message](./send-message.md)

Frontend:
- None

Backend:
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-service/src/main/java/io/yakable/service/turn/TurnService.java`
- `yakable-service/src/main/java/io/yakable/service/message/MessageService.java`
- `yakable-service/src/main/java/io/yakable/service/llm/PluginLlmClient.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmModelMetadata.java`

Data:
- Session
- Turn
- Message
- Model Metadata

Shared Rules:
- CONV-001
- CONV-009
- CONV-010
- CONV-011
- CONV-012
- CONV-014

Scenarios:
- CONV-S02
- CONV-S07

Tests:
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-core/src/test/java/io/yakable/core/llm/LlmModelMetadataTest.java`

## Purpose

决定当前 Turn 调用模型时，哪些 Session 历史能够进入 LLM 输入，以及如何控制 Token Budget。

## Contract

- Context 只来自当前 Session。
- 使用当前 Turn 固定的 provider / model Metadata。
- 当前 USER Message 始终完整保留。
- 历史从最近向更早按有界批次读取。
- 达到 Token Budget 后停止继续读取更老历史。
- SUCCEEDED complete exchange 可进入。
- STOPPED + non-empty Assistant 可进入。
- FAILED / PENDING / RUNNING 排除。
- 当前 Prompt 本身超限时明确失败，不调用 Provider。

## Flow

```text
execute Turn
→ load current USER Message
→ load model metadata
→ read recent eligible history
→ estimate token budget
→ stop at boundary
→ build LlmRequest
→ Provider Runtime
```

## Boundary

Owns:
- model input history selection
- token budget
- context eligibility

Does Not Own:
- UI history paging
- model selection UI
- provider HTTP protocol
