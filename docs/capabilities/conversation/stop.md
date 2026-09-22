# Stop

Status: Done
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

Scenarios:
- CONV-S02

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-service/src/test/java/io/yakable/service/turn/impl/TurnServiceImplTest.java`

## Purpose

用户显式停止当前正在生成的 Turn。

## Contract

- Stop 针对明确 turnId。
- 重复 Stop 必须安全。
- 非空 partial Assistant 持久化。
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
