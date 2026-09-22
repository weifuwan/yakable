# Session Domain

当前数据关系：

```text
Project
  └── Session
       └── Turn
            └── Message
```

## Session

Session 表示同一个 Project 中持续进行的一段对话。

V1 中每个 Project 只有一个 Session，并在 Project 创建时自动建立。Session 本身没有 ACTIVE / CLOSED / ARCHIVED 等生命周期状态；等待执行、生成中、成功、失败和停止都属于 Turn。

Session 只保存当前产品有明确语义的数据：

- 标题，初始值使用 Project 名称；
- 下一轮默认使用的 provider / model；
- 最近用户交互时间 `activity_time`。

`activity_time` 只在新的 USER Message 成功持久化时更新。Assistant 成功、失败、Stop、页面打开和刷新都不改变它。

## Turn

Turn 表示一次用户输入对应的一轮执行。

Turn 在创建时就固定本轮实际使用的 provider / model，后续执行和恢复都使用 Turn 自己的模型身份，不重新读取 Session 默认模型。

状态：

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED

PENDING / RUNNING -> STOPPED

RUNNING --recovery--> PENDING
```

`SUCCEEDED`、`FAILED`、`STOPPED` 是互斥终态。持久化更新只允许从合法的非终态进入终态，迟到的成功、失败或停止不能覆盖已经确定的终态。

同一个 Session 同一时间只允许一个 PENDING / RUNNING Turn。

## Message

Message 是 Session 内的消息记录，通过 `message_sequence` 保证稳定顺序。

单条 Message 的应用层上限为 2,000,000 个 Java 字符，数据库使用 MySQL `MEDIUMTEXT` 保存内容。这个上限同时约束用户输入和 Assistant 持久化内容，避免模型 Context 能力大于数据库字段容量时产生写入失败。

一轮交互只有在 USER Message 成功持久化后才正式成立。USER Message 建立后，即使模型失败或用户停止生成，也不能回滚或删除该消息。

Session 首次进入只加载最近 50 条 Message；更早历史通过 `beforeSequence` 向上分页加载。展示分页与 LLM Context 选择是两套独立规则。

## 创建 Turn

```text
SessionService
  -> 校验当前用户拥有 Session
  -> lock Session
  -> 检查 active Turn
  -> insert PENDING Turn，并固定 provider / model
  -> insert USER Message
  -> 更新 Session 默认模型与 activity_time
  -> commit
  -> executeTurnAsync
```

Project 创建时由 ProjectService 在同一事务中创建初始 Session、Turn 和 USER Message；事务提交后再启动 Turn 执行。

## 执行与 Streaming

```text
SessionService
  -> acquire global / user execution slot
  -> ThreadUtils
  -> claim PENDING
  -> build Context
  -> LlmClient.streamingChat
  -> persist SUCCEEDED / FAILED
  -> release execution slot
```

Turn 的后台执行生命周期不依赖某一个 SSE 连接。

SSE 只负责观察当前 Turn：

```text
watch existing Turn
  -> snapshot
  -> delta
  -> complete / error / stopped
```

浏览器刷新、页面切换、SSE timeout 或网络断开只会取消当前 watcher，不会把 Turn 标记为 STOPPED。用户显式点击 Stop 才会进入停止流程。

Streaming Assistant 内容同样受 Message 大小边界约束。流式缓冲达到上限后，本轮进入 FAILED，而不是继续增长内存或等到数据库写入时才失败；已经在边界内产生的部分内容仍按失败规则处理。

线程提交、异常兜底和调度线程池统一由 `ThreadUtils` 管理，业务 Service 不持有线程池。模型调用不放在数据库事务中。

Turn 执行有全局并发上限和单用户并发上限。没有可用执行槽位时，Turn 保持 `PENDING`，等待后续 Recovery 再次尝试；不为等待中的 Turn 创建无限内存队列。执行槽位在成功、失败、Stop、中断或任务异常结束时都会释放。

## Stop 与 Failure

用户 Stop 时：

- 已持久化的 USER Message 保留；
- 已生成且非空的 Assistant 部分内容会持久化；
- Turn 进入 `STOPPED`；
- 后台执行任务被取消；
- Session 可以继续创建下一轮。

模型调用失败时：

- USER Message 保留；
- 已生成且非空的 Assistant 部分内容会持久化；
- Turn 进入 `FAILED`；
- 该失败轮不会作为完整历史进入后续 Context。

## 恢复

SessionService 定期把超时的 RUNNING Turn 恢复为 PENDING，并重新提交同一个 Turn 执行。

恢复不会创建新的 Turn，也不会改变原 Turn 的 provider / model。前端重新进入 Session 时会订阅已经存在的 PENDING / RUNNING Turn；watcher 不可用时可以通过增量查询继续恢复状态。

恢复间隔和运行超时可配置，单次扫描上限暂固定为 100。Recovery 实际提交数量还受当前全局可用执行槽位约束，不会一次把全部 PENDING Turn 启动到 JVM 中。

执行并发通过 `yakable.turn-execution.max-concurrent` 和 `yakable.turn-execution.max-concurrent-per-user` 配置。默认值只是 SaaS V1 的安全边界，不代表性能目标；后续应根据真实压测和生产指标调整。

## Context

每轮模型调用的 Context 只来自当前 Session。

选择规则：

```text
当前 Turn 的 USER Message
+
从最近向更早选择：
  SUCCEEDED + 完整 USER / ASSISTANT -> 可进入
  STOPPED + 非空 ASSISTANT         -> 可进入
  FAILED                           -> 排除
  PENDING / RUNNING                -> 排除
```

每个受支持的 provider / model 必须提供 `LlmModelMetadata`。Session 根据当前 Turn 的模型 Token Budget 选择历史，不存在按固定轮数兜底的 Context 路径。

当前 Prompt 始终完整保留。加入更早历史会超过输入预算时，停止继续加入更老的历史；如果只保留当前 Prompt 仍然超过模型输入预算，本轮明确失败，不能静默截断 Prompt。

## 当前边界

Session V1 只负责稳定、可恢复的单 Session 对话闭环。

当前不包含第二个 Session、Session 列表与切换、Session 删除或归档、消息编辑删除、Regenerate、对话分支、Agent Tool、工作流和跨 Session 记忆。

只有真实产品需求出现后，再扩展这些能力；不要让 Turn、Message 或执行实现反向扩大 Session 的产品边界。
