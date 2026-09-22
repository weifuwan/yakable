# Conversation

> 产品定义：[Session](../../product/session.md)

Conversation 是 Yakable 当前最核心的运行链路。

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
         ↓
History + Context

Turn Navigator
→ 只负责长 Session 定位
```

能力块：

- [Send Message](./send-message/)
- [Streaming](./streaming/)
- [Stop](./stop/)
- [Reconnect](./reconnect/)
- [Recovery](./recovery/)
- [History](./history/)
- [Context](./context/)
- [Turn Navigator](./turn-navigator/)

## 共享不变量

这些规则属于整个 Conversation，不放进某一个局部能力重复维护：

- 数据库是 Session / Turn / Message 的最终事实来源。
- USER Message 持久化后，本轮才正式成立。
- 同一 Session 同一时间最多一个 PENDING / RUNNING Turn。
- SUCCEEDED / FAILED / STOPPED 是互斥终态，迟到事件不能覆盖终态。
- Turn Execution 生命周期不属于 SSE Connection。
- refresh / disconnect 不能自动 Stop。
- Recovery 继续原 Turn，不能创建替代 Turn 或第二条 USER Message。
- Message、Streaming Buffer、Context、Execution、Recovery 都必须有资源边界。
- SaaS V1 的 Stream State / Stop 协作是 JVM 本地状态，因此当前运行边界是单实例。

## 核心模型

```text
Project
  └── Session
       └── Turn
            └── Message
```

Turn 状态：

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED

PENDING / RUNNING -> STOPPED
RUNNING --recovery--> PENDING
```

## 代码总入口

Frontend：

```text
yakable-ui/src/features/session/components/SessionWorkspace.tsx
yakable-ui/src/service/session/
```

Backend：

```text
yakable-boot/.../controller/session/SessionController.java
yakable-service/.../session/SessionService.java
yakable-service/.../session/impl/SessionServiceImpl.java
yakable-service/.../turn/TurnService.java
yakable-service/.../message/MessageService.java
```

DAO：

```text
SessionRepository
TurnRepository
MessageRepository
```

## 运行问题从哪里开始看

```text
Prompt 创建 / 幂等      → Send Message
实时输出                → Streaming
用户主动终止            → Stop
刷新 / SSE 断开         → Reconnect
服务重启 / stale RUNNING → Recovery
历史分页                → History
LLM 输入历史            → Context
长 Session 定位         → Turn Navigator
```

原则：**Conversation README 只负责组装与共享不变量；具体实现进入对应能力块。**


## Reliability Acceptance

当前 Conversation / SaaS Reliability V1 已完成基础可靠性收口。

已落地的边界包括：

- Request Idempotency：Project / Turn 重试不重复建立业务数据，数据库唯一约束处理并发重复请求。
- Execution Resource Boundary：全局与单用户 Execution 有并发上限，PENDING 作为持久等待状态，不创建无限内存队列。
- Message Size Boundary：用户输入、Streaming Buffer、Message 持久化和数据库容量保持一致边界。
- Long Session Performance：Session 首屏、增量查询与 Context 历史读取保持有界。
- SaaS Runtime Boundary：当前明确单实例运行，支持 graceful shutdown 和同 Turn Recovery。
- Observability Baseline：HTTP trace、Conversation 生命周期日志、Actuator 与低基数 Metrics 已建立。
- Reliability Acceptance：真实 MySQL Integration Test 与本地验证命令保护关键持久化行为和前后端回归。

真实 MySQL 验收至少保护：

- Flyway 能在空 MySQL 8 实例迁移到当前 Schema。
- Message 内容字段使用与应用边界匹配的 `MEDIUMTEXT`。
- Project requestId、Turn requestId、Project 单 Session 等数据库唯一边界真实生效。
- Turn 成功后，迟到 Failure / Stop 不能覆盖终态。
- RUNNING Turn 可以原地恢复为 PENDING，并保留原 Turn、requestId、provider 和 model identity。

验证命令：

```text
./mvnw test
→ Unit Test

./mvnw verify
→ Unit Test + Testcontainers MySQL Integration Test

cd yakable-ui
npm run typecheck
npm run test
npm run build
→ TypeScript contract + frontend regressions + production bundle
```

当前不使用 GitHub CI。需要在功能开发与 Review 阶段按改动范围执行对应的本地验证命令。

当前历史代码仍存在与可靠性无关的 lint warning，因此 Reliability Acceptance 不要求全量 lint 清零；lint 继续作为独立代码质量治理项。

这里的 Done 只表示当前 V1 可靠性边界已经验收，不代表未来不会继续出现新的可靠性问题。
