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
