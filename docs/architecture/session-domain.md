# Session Domain

当前数据关系：

```text
Project
  └── Session
       └── Turn
            └── Message
```

## Session

Session 保存一次会话的模型配置和状态。

## Turn

Turn 表示一次用户输入对应的执行。

状态：

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED

RUNNING --recovery--> PENDING
```

同一个 Session 同一时间只允许一个 PENDING / RUNNING Turn。

## Message

Message 是会话消息记录，通过 `message_sequence` 保证顺序。

## 创建 Turn

```text
SessionService
  -> lock Session
  -> 检查 active Turn
  -> insert PENDING Turn
  -> insert USER Message
  -> commit
  -> executeTurnAsync
```

Project 创建首个 Session 时，由 ProjectService 在事务提交后调用 `SessionService.executeTurnAsync`。

## 执行 Turn

```text
SessionService
  -> ThreadUtils
  -> claim PENDING
  -> build context
  -> ModelClient
  -> persist SUCCEEDED / FAILED
```

线程提交、异常兜底和调度线程池统一由 `ThreadUtils` 管理，业务 Service 不持有线程池。

模型调用不放在数据库事务中。

## 恢复

SessionService 定期通过 TurnService 把超时的 RUNNING Turn 恢复为 PENDING，并重新提交执行。

恢复间隔和运行超时可配置，单次恢复数量暂固定为 100，不提前增加额外配置项。

## Context

模型上下文只包含：

```text
之前 SUCCEEDED Turn 的 Messages
+
当前 Turn 的 Messages
```

FAILED Turn 保留在数据库中，但默认不进入后续模型上下文。

## 当前原则

这套结构先保持简单。

只有真正出现独立调度策略、队列、限流、分布式 lease 或 MQ 需求时，再拆出独立执行组件。
