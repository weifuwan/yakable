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
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`

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

Known Gaps:
- GAP-07 — `SessionWorkspace` 在第一次 watch 当前 active turnId 时会把它永久加入 `watchedTurnIdsRef`。watcher 因临时网络错误结束后，finally 会清空 `streamingContent`，但 turnId 不会从该集合移除，因此当前页面生命周期内不会再次建立 SSE watcher，只剩数据库 polling。RUNNING partial 尚未持久化时，用户会丢失已经看到的 partial，并失去后续实时 delta，直到终态持久化结果出现；不满足 CONV-022 / CONV-S04。

Review Notes:
- GAP-04 已实现：Reconnect 继续复用 Streaming 的 WatcherSubscription，不新增私有排序或调度机制。
- 新 watcher 仍按 snapshot → future delta → terminal 入队，但实际 SSE callback 在独立 delivery 线程执行，不持有 Turn eventLock。
- 一个慢 Reconnect 连接不会阻塞同 Turn 的其他 watcher 或 Turn Runtime。
- unsubscribe 只关闭当前 watcher mailbox，不改变 Turn Execution。
- Reconnect API、changes fallback、SSE event schema 和前端均未修改。
- 当前执行环境无法解析 github.com，目标 Maven 测试尚未实际执行；测试通过前保持 Review。

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
→ queryChanges
→ converge persisted state
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
