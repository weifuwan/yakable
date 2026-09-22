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

Known Gaps:
- GAP-06 — stopTurn 先设置 `stoppingTurns` 再读取 `TurnStreamState.snapshot()`，但 Provider delta 对 `stoppingTurns` 的检查发生在 `state.delta()` 之前且不与 snapshot 共用原子边界；存在 post-cutover delta 可见但未持久化的竞态。GAP-06 runtime fix 当前尚未进入 main，本 PR 不处理。

Review Notes:
- GAP-08 已实现：成功 Stop 在 `streamState.stopped()` 发布 terminal 后立即 `stoppingTurns.remove(turnId)`，不再依赖 execution thread finally 做正常成功路径清理。
- terminal 发布后，late delta 会被 TurnStreamState 拒绝；late complete 无法把数据库中已 STOPPED 的 Turn 更新为 SUCCEEDED，因此立即清理 marker 不会重新开放业务状态。
- Stop transaction 抛错和终态更新失败路径仍会立即清理 marker。
- execution thread finally 中的 remove 保留为幂等兜底。
- 已新增 PENDING Turn + existing StreamState + Stop before execution 的回归测试，直接保护旧泄漏路径。
- Stop API、TurnExecutionVO、数据库、Provider 流程、GAP-06 和 GAP-07 均未修改。
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
