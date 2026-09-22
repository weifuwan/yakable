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
- CONV-020

Scenarios:
- CONV-S01
- CONV-S02
- CONV-S03
- CONV-S04
- CONV-S05
- CONV-S06
- CONV-S07
- CONV-S08
- CONV-S09

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`

Known Gaps:
- GAP-04 — TurnStreamState 在 eventLock 内直接执行 watcher callback。Controller listener 会同步调用 SseEmitter.send，因此慢 watcher 可能持有 eventLock，阻塞 future delta / terminal，并间接拖慢 Turn Execution；不满足 CONV-020。

Review Notes:
- GAP-02 实现已完成：TurnStreamState 现在使用同一个 event lock 串行化 subscribe / unsubscribe / delta / terminal。
- 新 watcher 的交接语义现在是 snapshot → future delta → terminal。
- 已新增并发回归测试，专门阻塞 snapshot callback 并并发产生 future delta / terminal，保护事件不能越过 snapshot。
- 当前执行环境无法解析 github.com，目标 Maven 测试尚未实际执行；测试通过前保持 Review。

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
