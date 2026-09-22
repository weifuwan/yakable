# Stop

Status: Implementing
Domain: Conversation

Depends On:
- [Streaming](./streaming.md)

Related:
- [History](./history.md)
- [Context](./context.md)
- [Reconnect](./reconnect.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-service/src/main/java/io/yakable/service/turn/TurnService.java`
- `yakable-service/src/main/java/io/yakable/service/message/MessageService.java`

Data:
- Turn
- Message
- Stream State

Shared Rules:
- CONV-004
- CONV-005
- CONV-006
- CONV-009
- CONV-010
- CONV-016
- CONV-018
- CONV-020
- CONV-021

Scenarios:
- CONV-S02
- CONV-S08
- CONV-S09

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-service/src/test/java/io/yakable/service/turn/impl/TurnServiceImplTest.java`

Known Gaps:
- GAP-08 — 对已有 StreamState 的 PENDING Turn 执行 Stop 时会加入 `stoppingTurns`。若 Turn 尚未成功 claim 为 RUNNING，后续 `executeTurnStreaming()` 会在进入 cleanup finally 前直接 return，导致该 turnId 永久留在 `stoppingTurns`，形成进程级集合泄漏。本 PR 不处理。

Implementation Design:
- stopTurn 对已有 TurnStreamState 使用 beginStopCutover()，不再通过普通 snapshot() 建立 Stop partial 边界。
- beginStopCutover() 在 Turn eventLock 内同时冻结后续 delta 并返回 cutover snapshot。
- STOPPED partial 只持久化该 cutover snapshot。
- cutover 后的 delta 即使 Provider callback 已经开始执行，也必须在 state.delta() 内被拒绝。
- Stop transaction 抛错或 updateTurnStopped 返回 0 时，调用 cancelStopCutover()；只有 Stream 尚未 terminal 时才重新允许 delta。
- Stop 成功后保持 cutover，随后 state.stopped() 发布 terminal；不等待 watcher 网络发送完成。
- 本次不处理 stoppingTurns 的 PENDING cleanup（GAP-08）。

Review Notes:
- GAP-04 watcher isolation 已实现，Stop 仍不能等待 watcher callback。
- CONV-S02 / CONV-S08 既有语义必须保持不变。

## Purpose

用户显式停止当前正在生成的 Turn。

## Contract

- Stop 针对明确 turnId。
- 重复 Stop 必须安全。
- 非空 partial Assistant 持久化。
- 没有 Assistant 内容时不创建空 Assistant Message。
- Turn 原子进入 STOPPED。
- 后台执行被取消或尽快终止。
- Watcher 最终观察到 STOPPED。
- Stop 完成后 Session 可以开始下一轮。
- Disconnect / Refresh 不能复用 Stop 路径。

## Flow

```text
SessionWorkspace.handleStop
→ SessionService.stopTurn
→ POST /turns/{turnId}/stop
→ SessionController
→ SessionServiceImpl.stopTurn
→ persist partial
→ TurnService.updateTurnStopped
→ cancel execution
→ streamState.stopped
```

## Boundary

Owns:
- explicit user stop
- partial persistence on stop
- STOPPED transition
- execution cancellation

Does Not Own:
- transport disconnect
- page unload
- recovery
