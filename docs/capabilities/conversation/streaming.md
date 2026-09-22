# Streaming

Status: Review
Domain: Conversation

Depends On:
- [Send Message](./send-message.md)
- [Provider Runtime](../model/provider-runtime.md)

Related:
- [Stop](./stop.md)
- [Reconnect](./reconnect.md)
- [Recovery](./recovery.md)
- [History](./history.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/features/session/components/MessageItem.tsx`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-service/src/main/java/io/yakable/service/session/TurnStreamListener.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmClient.java`
- `yakable-core/src/main/java/io/yakable/core/llm/LlmStreamEvent.java`

Data:
- Turn
- Message
- Stream State

Shared Rules:
- CONV-001
- CONV-004
- CONV-005
- CONV-006
- CONV-009
- CONV-012
- CONV-013
- CONV-015
- CONV-016
- CONV-018
- CONV-019

Scenarios:
- CONV-S01
- CONV-S02
- CONV-S03
- CONV-S04
- CONV-S05
- CONV-S06
- CONV-S07
- CONV-S08

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`

Known Gaps:
- 当前 TurnStreamState 订阅顺序是先注册 listener 再读取 snapshot；并发 delta 可能在 snapshot 之前到达，并被 snapshot 再次包含，存在重复 / 乱序竞态。当前测试未覆盖该并发窗口。

## Purpose

Assistant 内容生成一部分就展示一部分，不等待完整回答。

## Contract

- Turn Execution 不依赖某一个 SSE Watcher 存活。
- 新 Watcher 观察活动 Turn 时先得到当前 Snapshot，再接收后续 Delta。
- terminal 发布前，应该持久化的 Assistant 内容必须先完成持久化。
- Stop / Failure 时非空 partial Assistant 保留。
- 用户阅读历史时，Streaming 继续执行但不能强制抢回阅读位置。
- Stream Buffer 有明确大小边界。
- 当前 Stream State 是 JVM 本地状态。

## Flow

```text
executeTurnAsync
→ claim PENDING
→ LlmClient.streamingChat
→ LlmProvider
→ LlmStreamEvent
→ TurnStreamState
→ watcher
→ SSE
→ SessionService.ts
→ SessionWorkspace
```

## Boundary

Owns:
- runtime Assistant buffer
- snapshot / delta / terminal events
- watcher notification
- frontend streaming rendering

Does Not Own:
- Turn creation
- business Stop decision
- reconnect policy
- server recovery
