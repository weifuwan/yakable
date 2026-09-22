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
SessionController
SessionService / SessionServiceImpl
TurnService
MessageService
```

DAO：

```text
SessionRepository
TurnRepository
MessageRepository
```

原则：**Conversation README 只负责组装；具体改动进入对应能力块。**
