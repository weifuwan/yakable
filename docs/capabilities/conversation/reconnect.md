# Reconnect

Status: Implementing
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

Implementation Design:
- Reconnect 不新增独立调度或排序机制，继续复用 Streaming 的 WatcherSubscription。
- 新 watcher 仍按 snapshot → future delta → terminal 入队。
- watcher callback 在独立 delivery 线程执行，一个慢 Reconnect 连接不能持有 Turn eventLock，也不能阻塞其他 watcher。
- unsubscribe 只关闭当前 watcher mailbox，不影响同一 Turn 的 Execution 或其他 watcher。
- 本次不修改 watchTurn API、changes fallback、SSE event schema 或前端。

Review Notes:
- GAP-02 snapshot / future delta ordering 必须继续成立。
- GAP-03 multi-tab convergence 必须继续成立。

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
