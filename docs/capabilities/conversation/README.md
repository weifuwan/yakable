# Conversation Domain

Product:
- [Session](../../product/session.md)

## Graph

```text
Send Message
    ↓
Streaming
 ┌──┼──────────┐
 Stop        Reconnect
    │            │
    └────┬───────┘
         ↓
      Recovery

History ───── Context

Turn Navigator
→ long-session navigation only
```

Capabilities:

- [Send Message](./send-message.md)
- [Streaming](./streaming.md)
- [Stop](./stop.md)
- [Reconnect](./reconnect.md)
- [Recovery](./recovery.md)
- [History](./history.md)
- [Context](./context.md)
- [Turn Navigator](./turn-navigator.md)

## Shared Rules

### CONV-001 — Persistent Facts

Session / Turn / Message 的最终事实来源是数据库。

浏览器状态、SSE Connection 和 JVM Runtime State 都不能成为核心业务事实的唯一来源。

### CONV-002 — Turn Establishment

USER Message 成功持久化后，本轮才正式成立。

本轮成立时必须能够确定 Session、Turn、USER Message、requestId 和 provider / model。

### CONV-003 — Single Active Turn

同一 Session 同一时间最多存在一个 PENDING / RUNNING Turn。

该规则由服务端与数据库边界保护，不能只依赖前端按钮禁用。

### CONV-004 — Terminal State

SUCCEEDED / FAILED / STOPPED 是互斥终态。

迟到的 Complete / Failure / Stop / Recovery 不能覆盖已经确定的终态。

### CONV-005 — Execution Is Not Connection

Turn Execution 生命周期与 SSE Connection 生命周期分离。

Watcher 只观察执行，不拥有执行。

### CONV-006 — Disconnect Is Not Stop

Refresh、页面切换、Tab 后台、SSE Timeout、网络断开都不能自动触发 STOPPED。

只有显式 Stop 请求拥有 Stop 语义。

### CONV-007 — Reconnect Same Turn

Reconnect 必须继续原 turnId。

不能通过重新提交 Prompt、创建新 Turn 或创建第二条 USER Message 恢复生成。

### CONV-008 — Recovery Same Turn

Recovery 必须继续原 Turn、原 USER Message 和原 provider / model identity。

stale RUNNING 可以原地恢复为 PENDING，再重新 claim。

### CONV-009 — Partial Assistant

Stop / Failure 时已经产生的非空 Assistant 内容必须保留。

FAILED partial 只用于历史展示，不进入后续 Context。

STOPPED + 非空 Assistant 可以进入后续 Context。

### CONV-010 — Context Boundary

Context 只来自当前 Session。

可进入：

```text
SUCCEEDED + complete USER / ASSISTANT
STOPPED + non-empty ASSISTANT
```

排除：

```text
FAILED
PENDING
RUNNING
```

### CONV-011 — Prompt Integrity

当前 Prompt 不能为了容纳历史 Context 被静默截断。

移除历史后 Prompt 仍超过模型输入边界时，本轮明确失败。

### CONV-012 — Bounded Resources

所有可增长资源都必须有明确上限或释放条件，包括 Message Size、Streaming Buffer、Execution Concurrency、Watcher、Recovery Batch、History Page、Context Token Budget、后台线程、HTTP / SSE / 数据库连接和任务队列。

PENDING 是持久等待状态，不是无限 JVM 内存队列。

业务代码不得创建无管理的无限线程池或无限队列；后台任务统一使用项目受管理的线程能力。

### CONV-013 — Runtime Boundary

当前 SaaS V1 的 Stream State / Stop 协作是 JVM 本地状态，因此后端运行边界是单实例。

正常停机采用 graceful shutdown；未完成 RUNNING Turn 回到 PENDING，再由 Recovery 继续原 Turn。

### CONV-014 — History Is Not Context

UI Message History 与 LLM Context 是两个独立的数据选择机制。

History 分页不能决定模型 Context，Context 构建也不能要求前端一次加载全部历史。

### CONV-015 — Observability

Conversation 状态问题必须能够通过 requestId / userId / projectId / sessionId / turnId 关联定位。

关键运行指标至少覆盖：

- PENDING / RUNNING Turn。
- SUCCEEDED / FAILED / STOPPED。
- stale / shutdown Recovery。
- Execution concurrency / rejection。
- Provider latency / error。
- active watcher。
- idempotency replay。
- Message Size reject。
- Context Too Large。

日志不记录完整 Prompt、完整 Assistant、API Key、Cookie 或 Token。



### CONV-016 — Ownership

Project Ownership 是 Session / Turn / Message 的根访问边界。

所有用户可触发的 Conversation 读写都必须验证当前用户拥有对应 Project；知道 projectId / sessionId / turnId / messageId 不能绕过 ownership。

### CONV-017 — Request Identity

同一个逻辑提交使用同一个 requestId 重试时，必须返回原 Turn / USER Message，不能产生第二份业务数据，也不能再次更新 activity。

同一个 requestId 如果被用于不同 Prompt、不同 Session 或不同 provider / model 语义，必须明确拒绝冲突，不能静默当作幂等成功。

### CONV-018 — Establishment Error Boundary

USER Message 成立前发生错误时，本轮不成立，前端保留 Prompt 供修正或安全重试。

USER Message 一旦成立，后续 Provider / Context / Streaming / Recovery 错误都必须作用于原 Turn；不能通过删除 USER Message、重新创建 Turn 或重新提交 Prompt 来“恢复”。

### CONV-019 — External Execution Boundary

建立 Turn / USER Message 的数据库事务必须先完成，再启动外部 LLM 执行。

外部 Provider 调用不能放在建立本轮业务事实的数据库事务中。

## Cross-Capability Scenarios

### CONV-S01 — Send → Stream → Complete

Involves:
- Send Message
- Streaming
- History

Guarantees:
- USER Message 先成立。
- 同一个 Turn 进入执行。
- Streaming 完成后 Assistant 持久化。
- History 最终收敛到持久化结果。

### CONV-S02 — Streaming → Stop → Next Turn

Involves:
- Streaming
- Stop
- History
- Context

Guarantees:
- Stop 只作用于明确 turnId。
- 非空 partial Assistant 保留。
- Turn 进入 STOPPED。
- 下一轮可以继续创建。
- STOPPED partial 可按 CONV-010 进入后续 Context。

### CONV-S03 — Streaming → Refresh → Reconnect

Involves:
- Streaming
- Reconnect
- History

Guarantees:
- 使用同一个 turnId。
- 不重新提交 Prompt。
- 新 Watcher 先恢复 Snapshot，再接收后续 Delta。
- Refresh 不触发 Stop。
- 最终 History 与持久化结果一致。

### CONV-S04 — Streaming → Network Disconnect → Reconnect

Involves:
- Streaming
- Reconnect

Guarantees:
- Watcher 断开释放连接资源。
- Turn Execution 继续。
- 网络恢复后重新观察原 Turn。
- 多次 reconnect 不创建重复 Turn。

### CONV-S05 — Service Restart → Recovery

Involves:
- Streaming
- Recovery

Guarantees:
- 未完成 RUNNING Turn 不永久卡死。
- 原 Turn 回到 PENDING。
- 原 provider / model identity 保留。
- 不创建替代 Turn 或第二条 USER Message。
- V1 不保证从 Provider 崩溃前的某个 token 位置继续原网络流。
- 未持久化的实时 Delta 可能丢失；Recovery 可以在同一个 Turn 上重新执行 Provider 调用。

### CONV-S06 — Read History → New Streaming Delta

Involves:
- History
- Streaming

Guarantees:
- 用户主动阅读历史时，新 Delta 不强制修改阅读位置。
- Streaming 继续执行。
- 离开 latest 后提供明确的回到最新位置入口。
- 用户回到 latest 后恢复 follow output。

### CONV-S07 — Provider Failure After Establishment

Involves:
- Streaming
- History
- Context

Guarantees:
- USER Message 保留。
- 非空 partial Assistant 保留。
- 没有 Assistant 内容时不创建空 Assistant Message。
- Turn 进入 FAILED。
- partial 可展示，但不进入后续 Context。

### CONV-S08 — Multiple Tabs Observe Same Turn

Involves:
- Streaming
- Reconnect
- Stop

Guarantees:
- 多个 Tab 可以有多个 Watcher，但只有一个真实 Turn Execution。
- 所有 Watcher 最终观察到同一个 Turn 内容和终态。
- 任一 Tab 的显式 Stop 是对该 Turn 的业务 Stop，其他 Tab 最终也看到 STOPPED。
- 多 Tab reconnect 不能创建新 Turn。

## Code Roots

Frontend:

```text
yakable-ui/src/features/session/
yakable-ui/src/service/session/
```

Backend:

```text
yakable-boot/src/main/java/io/yakable/boot/controller/session/
yakable-service/src/main/java/io/yakable/service/session/
yakable-service/src/main/java/io/yakable/service/turn/
yakable-service/src/main/java/io/yakable/service/message/
```

DAO:

```text
yakable-dao/src/main/java/io/yakable/dao/repository/
yakable-dao/src/main/java/io/yakable/dao/entity/
```

Domain Tests:

```text
yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java
yakable-service/src/test/java/io/yakable/service/session/impl/SessionServiceImplTest.java
yakable-service/src/test/java/io/yakable/service/turn/impl/TurnServiceImplTest.java
yakable-service/src/test/java/io/yakable/service/message/impl/MessageServiceImplTest.java
yakable-boot/src/test/java/io/yakable/boot/integration/ConversationPersistenceIT.java
yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx
yakable-ui/src/service/session/__tests__/SessionService.test.ts
```
