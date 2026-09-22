# Streaming

Status: Implementing
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

Implementation Design:
- TurnStreamState 继续用 eventLock 保护 content / terminal / watcher membership 与事件入队顺序。
- eventLock 内禁止执行 TurnStreamListener 外部 callback。
- 每个 watcher 包装成独立 WatcherSubscription，拥有自己的串行 delivery mailbox。
- snapshot / delta / terminal 在 eventLock 内按发生顺序写入对应 watcher mailbox，因此继续保持 GAP-02 的 snapshot → future delta → terminal 契约。
- mailbox 由 ThreadUtils 的独立虚拟线程异步 drain；SseEmitter.send 只发生在 watcher delivery 线程，不占用 Turn eventLock，也不占用 Provider Execution 线程。
- 相邻未发送 delta 在 mailbox 中合并成一个 delta chunk；单 Turn 总内容仍受 MessageConstant.MAX_CONTENT_LENGTH 约束，避免慢 watcher 按 token 数无限堆积事件对象。
- unsubscribe 会关闭对应 WatcherSubscription、丢弃未发送事件并取消其 delivery task，不影响其他 watcher。
- 本次不修改 SSE API、Turn 状态机、Reconnect API、Stop API、数据库或前端。

Review Notes:
- GAP-02 的事件顺序约束必须在本次实现后继续成立。
- GAP-03 的多 watcher STOPPED 收敛行为必须继续成立。

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
