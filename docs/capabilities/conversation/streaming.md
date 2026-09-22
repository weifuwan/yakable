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
- CONV-021

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
- TurnStreamState 增加 Stop cutover 状态，并与 delta() 共用同一个 eventLock。
- stopTurn 不再只读取 snapshot，而是调用 beginStopCutover()：在 eventLock 内一次性“禁止后续 delta + 返回当前 partial snapshot”。
- Provider delta 即使已经通过外层 stoppingTurns 检查，进入 state.delta() 后仍必须再次在 eventLock 内检查 cutover；cutover 后的 delta 直接丢弃，不进入 content，也不进入 watcher mailbox。
- 如果 delta 先获得 eventLock，它必须先进入 content / watcher mailbox；随后 Stop 获取到的 snapshot 必须包含该 delta。
- 如果 Stop 先获得 eventLock，后续 delta 必须被拒绝，因此 watcher 不会看到无法持久化的 post-cutover 内容。
- Stop 持久化失败或未完成终态更新时，调用 cancelStopCutover() 恢复 delta 接收；如果 Stream 已 terminal，则不重新开放。
- 本次不修改 Provider 协议、SSE schema、数据库、前端或 GAP-07 / GAP-08。

Review Notes:
- GAP-02 snapshot ordering、GAP-03 multi-watcher、GAP-04 watcher isolation 都必须继续成立。

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
