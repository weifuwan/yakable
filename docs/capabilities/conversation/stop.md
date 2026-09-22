# Stop

Status: Review
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

Scenarios:
- CONV-S02
- CONV-S08
- CONV-S09

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-service/src/test/java/io/yakable/service/turn/impl/TurnServiceImplTest.java`

Review Notes:
- GAP-04 已实现：stopTurn 读取 partial snapshot 时只竞争短生命周期 Turn eventLock；watcher callback 已移出该锁。
- STOPPED terminal 只在 eventLock 内按顺序写入各 watcher mailbox，stopTurn 不等待实际网络发送完成。
- 已新增慢 watcher 回归测试，保护 slow callback 未释放时 explicit Stop 仍可完成，fast watcher 仍可收到 STOPPED。
- Stop API、partial persistence 和 Turn terminal 语义未修改。
- 当前执行环境无法解析 github.com，目标 Maven 测试尚未实际执行；测试通过前保持 Review。

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
