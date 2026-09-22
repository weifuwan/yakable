# Recovery

Status: Done
Domain: Conversation

Depends On:
- [Streaming](./streaming.md)

Related:
- [Reconnect](./reconnect.md)

Frontend:
- None

Backend:
- `yakable-service/src/main/java/io/yakable/service/session/impl/SessionServiceImpl.java`
- `yakable-service/src/main/java/io/yakable/service/turn/TurnService.java`

Data:
- Turn
- Message

Shared Rules:
- CONV-001
- CONV-004
- CONV-008
- CONV-012
- CONV-013
- CONV-015

Scenarios:
- CONV-S05

Tests:
- `yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java`
- `yakable-service/src/test/java/io/yakable/service/turn/impl/TurnServiceImplTest.java`
- `yakable-boot/src/test/java/io/yakable/boot/integration/ConversationPersistenceIT.java`

## Purpose

让已经持久化但未完成的 Turn 在调度失败、服务重启或 RUNNING 超时后，不永久卡死。

## Contract

- PENDING 是可恢复持久状态。
- stale RUNNING 可以原地恢复为 PENDING。
- Recovery 使用原 Turn、原 USER Message 和原 provider / model。
- Recovery 不更新 Session activity。
- Recovery 不创建替代 Turn。
- Recovery 单批处理数量受限。
- 执行容量不足时 Turn 继续保持 PENDING。
- graceful shutdown 未完成 Turn 交回 Recovery。

## Flow

```text
scheduled recovery
→ stale RUNNING -> PENDING
→ query bounded PENDING ids
→ executeTurnAsync(turnId)
→ acquire execution slot
→ claim
→ execute
```

## Boundary

Owns:
- server-side execution recovery
- stale RUNNING recovery
- pending redispatch

Does Not Own:
- browser reconnect
- transport watcher recovery
