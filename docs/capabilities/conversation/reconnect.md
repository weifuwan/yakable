# Reconnect

Status: Review
Domain: Conversation

Depends On:
- [Streaming](./streaming.md)
- [History](./history.md)

Related:
- [Stop](./stop.md)
- [Recovery](./recovery.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/features/session/hooks/useTurnStream.ts`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-core/src/main/java/io/yakable/core/conversation/stream/TurnStreamRuntime.java`
- `yakable-core/src/main/java/io/yakable/core/conversation/stream/TurnStreamListener.java`

Data:
- Session
- Turn
- Message

Shared Rules:
- CONV-001
- CONV-004
- CONV-005
- CONV-006
- CONV-007
- CONV-013
- CONV-016
- CONV-020
- CONV-022

Scenarios:
- CONV-S03
- CONV-S04
- CONV-S08
- CONV-S09

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-core/src/test/java/io/yakable/core/conversation/stream/TurnStreamRuntimeTest.java`

Review Notes:
- Browser watch / rewatch / polling fallback ownership 已收口到 useTurnStream；Reconnect 行为与 SessionService SSE Contract 未修改。
- GAP-07 已实现：active Turn watcher 临时失败后保留当前 streamingContent，不再立即清空用户已经看到的 partial。
- watcher failure 先通过 queryChanges 收敛持久化状态；只有 Turn 仍是 PENDING / RUNNING，或 changes 暂时不可用时，才在固定 1s 延迟后 rewatch 原 turnId。
- queryChanges 已确认 SUCCEEDED / FAILED / STOPPED 时停止 rewatch，并由持久化结果替换 streaming partial。
- rewatch 始终调用 watchTurn(originalTurnId)，不重新提交 Prompt，不创建新 Turn / USER Message。
- retry 等待期间 polling 仍可继续工作；watch effect 不再依赖 latestSequence，因此 polling 的 sequence 更新不会取消 retry timer。
- Session / Project 切换会通过 effect cleanup 取消旧 watcher 和 retry timer。
- 已新增“临时断网后保留 partial 并 rewatch 同一 Turn”以及“终态后不继续 rewatch”两条前端回归测试。
- SessionService SSE 协议、后端、数据库、Stop 和 GAP-08 均未修改。
- 当前执行环境无法解析 github.com，目标 Vitest 尚未实际执行；测试通过前保持 Review。

## Purpose

浏览器刷新、页面重开或 SSE 断开后，继续观察同一个活动 Turn，而不是重新提交 Prompt。

## Contract

- Session 重新进入时先查询持久化状态。
- 存在 PENDING / RUNNING Turn 时继续 watch 原 turnId。
- 新 Watcher 先收到当前 Snapshot，再进入后续 Delta。
- Reconnect 不创建 Turn 或 USER Message。
- Watcher 失败时通过 changes 查询继续收敛状态。
- Turn 已终态时恢复最终持久化结果。
- 多 Tab 可以有多个 Watcher，但只能有一个真实 Execution。

## Flow

```text
Session open / reconnect
→ querySession
→ find active turnId
→ watchTurn(turnId)
→ POST /turns/{turnId}/stream
→ snapshot
→ delta
→ terminal

watch failure
→ preserve visible partial
→ queryChanges
→ terminal? converge persisted state
→ still active / changes unavailable? wait 1s
→ rewatch same turnId
```

## Boundary

Owns:
- browser / transport reconnect
- watch existing Turn
- snapshot restoration
- changes fallback

Does Not Own:
- server process recovery
- Stop
- Turn creation
