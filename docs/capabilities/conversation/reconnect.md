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
- GAP-04 — Reconnect 依赖 Streaming 的 watcher delivery。当前 SseEmitter callback 在 TurnStreamState eventLock 内执行，慢连接可能阻塞同 Turn 的其他 watcher 与后续事件；不满足 CONV-020。

Review Notes:
- GAP-02 的 snapshot / future delta ordering 已在 Streaming 的 TurnStreamState 中实现，不新增 Reconnect 私有排序机制。
- GAP-03 不需要生产代码改动；当前 TurnStreamState 已支持多个 watcher，watchTurn 不启动新的 Execution。
- 已新增 CONV-S08 回归测试：两个 watcher 订阅同一 running Turn，单次 Stop 后两个 watcher 都收到 STOPPED，且 watcher 可独立 unsubscribe。
- 测试同时验证 watch / stop 路径不会调用 LLM Provider，因此不会因为多 Tab 创建额外 Execution。
- Reconnect API、changes fallback、SSE contract 和前端均未修改。
- 当前执行环境无法访问 github.com，目标 Maven 测试尚未实际执行；测试通过前保持 Review。

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
