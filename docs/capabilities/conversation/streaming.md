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

Review Notes:
- GAP-04 已实现：TurnStreamState 的 eventLock 只保护 content / terminal / watcher membership 与事件入队，不再执行外部 TurnStreamListener callback。
- 每个 watcher 使用独立 WatcherSubscription 串行 mailbox，通过 ThreadUtils 虚拟线程异步 delivery。
- snapshot / future delta / terminal 仍按 eventLock 中的入队顺序进入同一个 watcher mailbox，继续满足 GAP-02 的顺序契约。
- 慢 watcher 的相邻 pending delta 会合并为一个 chunk；mailbox 不按 token 数无限增长，文本总量继续受 MessageConstant.MAX_CONTENT_LENGTH 约束。
- 已新增慢 watcher 回归测试，保护“慢 watcher 不阻塞其他 watcher，也不阻塞 explicit Stop”。
- 既有 GAP-02 snapshot ordering 与 GAP-03 multi-watcher STOPPED 测试已调整为等待异步 delivery。
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
