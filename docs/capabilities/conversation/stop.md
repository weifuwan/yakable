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

Review Notes:
- GAP-06 已实现：stopTurn 对已有 TurnStreamState 使用 beginStopCutover()，以同一个 eventLock 原子完成“冻结 delta + 截取 partial snapshot”。
- STOPPED partial 只持久化 cutover snapshot；post-cutover delta 会在 state.delta() 内被拒绝。
- Stop transaction 抛错或 updateTurnStopped 未成功时会 rollback 当前 cutover，允许原 Turn 继续接收 delta。
- 并发 Stop 使用 cutover 计数，单个失败 Stop 不会误释放另一个仍有效的 cutover。
- 已新增并发 Stop / Delta 竞态测试，以及 Stop 持久化失败后的 rollback 测试。
- GAP-08 已实现：成功 Stop 在 streamState.stopped() 发布 terminal 后立即清理 stoppingTurns，不再依赖 execution thread finally 做正常成功路径清理。
- execution thread finally 中的 remove 保留为幂等兜底。
- 已新增 PENDING Turn + existing StreamState + Stop before execution 的回归测试。
- Stop API、partial persistence schema、Turn terminal 状态机和 watcher delivery 均未修改。
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
