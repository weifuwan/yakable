# Yakable Conversation Infrastructure PRD V1

> 状态：Draft  
> 版本：V1  
> 范围：Conversation Infrastructure  
> 原则：先把对话基础设施做稳定，再向 Workspace、Harness 和代码生成继续演进

## 1. 背景

Yakable 后续要承载 Project / Workspace、Frontend Taste Harness 和代码生成，但这些能力最终都会建立在一次次 AI Conversation 之上。

如果最底层的 Conversation 仍然存在重复提交、刷新丢失、断网中断、状态卡死、Stop 语义不清、资源无限占用等问题，上层能力越多，系统越难稳定。

Conversation Infrastructure V1 不增加新的产品功能，而是为已经存在的：

```text
Project
  ↓
Session
  ↓
Turn
  ↓
Message
  ↓
LLM
```

建立一套明确、可恢复、可验证的运行契约。

目标不是“能聊天”，而是让这条链路能够作为 SaaS 基础设施长期运行。

## 2. 与现有文档的关系

### Project PRD

Project PRD 定义“这个工作是什么、属于谁、从哪里继续”。

Conversation Infrastructure 不重新定义 Project 产品行为，只保证 Project 创建和首次对话在异常情况下仍然满足持久化、幂等和恢复要求。

### Session PRD

Session PRD 定义“用户如何持续完成一段对话”。

Conversation Infrastructure 将其中已经确定的发送、Streaming、Stop、Failure、Recovery、Context 等产品语义提升为基础设施保证。

Session PRD 决定产品行为，Conversation Infrastructure 决定这些行为在网络异常、并发、重试和服务异常下如何仍然成立。

### SaaS Reliability V1

`docs/quality/saas-reliability-v1.md` 是 Yakable 整体 SaaS 的质量底线。

Conversation Infrastructure V1 是这套质量规则在 AI Conversation 核心链路上的具体契约。

本 PRD 不覆盖 SaaS Reliability，而是把其中与 Conversation 直接相关的要求变成可验收行为。

## 3. V1 目标

Conversation Infrastructure V1 必须保证：

- 一次用户提交只形成一次业务结果。
- USER Message 一旦正式成立，就不能因为后续模型、网络或浏览器异常而丢失。
- Turn Execution 生命周期与浏览器连接生命周期分离。
- 浏览器刷新、切换页面、SSE 断开或短暂断网不能被解释为用户 Stop。
- 用户重新进入 Session 后能够恢复同一个活动 Turn，而不是重新提交 Prompt。
- 重新连接后能够继续观察同一个 Turn 已经产生和后续产生的 Assistant 内容。
- Stop、Failure、Success 都有明确且互斥的终态。
- 服务异常后，PENDING / RUNNING Turn 不会永久卡死。
- 同一 Session 不会因为重试、多 Tab 或并发请求产生重复 Turn。
- Message、Context、Streaming Buffer、Execution 和 Recovery 都有明确资源边界。
- Conversation 问题能够通过日志和指标定位。

## 4. V1 不做

Conversation Infrastructure V1 不增加：

- Agent。
- Tool Call。
- Workflow。
- 多步骤任务编排。
- 多 Session 产品能力。
- Message Edit / Regenerate / Branch。
- 跨 Session 长期记忆。
- 自动总结。
- 通用任务平台。
- MQ。
- Redis。
- 分布式锁。
- 通用重试框架。
- 为未来多实例提前设计的复杂分布式 Streaming。

V1 也不承诺：

> 服务进程已经崩溃后，从第三方 Provider 的某一个 token 位置继续原始网络流。

V1 必须保证的是：

> 浏览器连接异常后重新观察同一个 Turn；服务异常后同一个 Turn 最终能够恢复执行或进入明确终态，并且不能创建重复 Turn / USER Message。

如果未来多实例、超长任务或 Agent Execution 对 Streaming 有更强要求，再基于真实问题升级。

## 5. 核心概念

### 5.1 Session

Session 是持续对话容器。

Session 不拥有单次模型调用的执行状态。

V1 中是否允许发送下一轮，由当前 Session 是否已经存在 PENDING / RUNNING Turn 决定。

### 5.2 Turn

Turn 表示一次用户提交形成的一轮交互。

Turn 同时承担这一轮的：

- 请求身份。
- 模型身份。
- 执行状态。
- Recovery 身份。

一个 Turn 从建立以后必须始终是同一个 Turn，不能因为刷新、重连或恢复重新创建替代 Turn。

### 5.3 Message

Message 是 Conversation 中需要长期保存的内容。

USER Message 成功持久化后，本轮交互正式成立。

Assistant Message 只有在存在实际内容时才需要持久化，空的 Assistant Message 不用于填补结构。

### 5.4 Execution

Execution 表示 Turn 背后真实的模型执行过程。

Execution 是运行概念，不要求为了本 PRD额外创建新的数据库实体。

V1 可以继续使用 Turn 的状态、attempt、startedAt、finishedAt 等信息表达执行生命周期。

核心规则是：

```text
Turn
!=
SSE connection
```

### 5.5 Stream Watcher

Stream Watcher 是浏览器观察当前 Turn 的传输连接。

Watcher 可以创建、断开、重新创建。

Watcher 不拥有 Execution，也不能因为自身断开改变 Turn 状态。

## 6. 核心不变量

以下规则在任何正常或异常路径下都必须成立。

### 6.1 数据事实来源

Project、Session、Turn、Message 的最终事实来源是数据库。

浏览器状态、SSE 连接和 JVM 内存都不能成为这些业务状态的唯一事实来源。

### 6.2 一轮交互的成立边界

只有 USER Message 成功持久化后，一轮交互才正式成立。

正式成立时必须同时能够确定：

- Session。
- Turn。
- USER Message。
- Provider / Model。
- Request Identity。

不能出现“用户消息已经存在，但 Turn 或本轮模型身份不确定”的半完成状态。

### 6.3 单活动 Turn

同一个 Session 同一时间最多只有一个：

```text
PENDING
或
RUNNING
```

Turn。

该规则必须由服务端和数据库相关边界共同保护，不能只依赖前端禁用按钮。

### 6.4 终态不可逆

Turn 终态只有：

```text
SUCCEEDED
FAILED
STOPPED
```

三者互斥。

Turn 一旦进入终态，迟到的：

- Provider Complete。
- Provider Failure。
- Stop。
- Recovery。
- 重复请求。

都不能覆盖已经确定的终态。

### 6.5 Stream 不拥有 Execution

以下事件只能影响当前 Watcher：

- 浏览器刷新。
- 页面跳转。
- Tab 切换。
- SSE timeout。
- 网络断开。
- SSE transport error。

它们不能自动把 Turn 改成 STOPPED。

只有明确的用户 Stop 请求才能触发 STOPPED 语义。

## 7. Conversation Lifecycle

### 7.1 用户发送

一次正常提交应满足：

```text
Client generates requestId
  ↓
validate request
  ↓
transaction
  ├─ create / resolve Turn
  ├─ persist USER Message
  ├─ persist Turn model identity
  └─ update Session activity
  ↓
commit
  ↓
Turn is established
  ↓
best-effort dispatch
  ↓
PENDING -> RUNNING
  ↓
LLM Streaming
  ↓
SUCCEEDED / FAILED / STOPPED
```

外部 LLM 调用不能位于建立 USER Message 的数据库事务中。

数据库提交成功而即时 dispatch 失败时，Turn 保持 PENDING，等待现有 Recovery 机制重新发现。

### 7.2 页面进入

进入 Session 时：

```text
load persisted Session / Message history
  ↓
find active Turn
  ↓
no active Turn -> normal idle state

active Turn exists
  ↓
watch the same turnId
  ↓
receive current snapshot
  ↓
receive future deltas
  ↓
receive terminal state
```

页面不能通过重新发送原 Prompt 的方式恢复生成。

### 7.3 连接断开

当 Watcher 断开：

```text
unsubscribe watcher
  ↓
release transport resources
  ↓
Turn execution continues
```

断开本身不能：

- 创建新 Turn。
- 创建新 Message。
- Stop Turn。
- 修改 Session activity。
- 重新调用 LLM。

### 7.4 重新连接

重新连接必须继续观察原来的 `turnId`。

服务端需要能够向新 Watcher 提供当前 Turn 的最新可观察 Assistant Snapshot，然后继续发送新的 Delta。

客户端重新连接时，应以服务端 Snapshot 重建当前活动回答，避免因为旧客户端临时 buffer 与新 Delta 拼接造成：

- 重复文字。
- 缺少文字。
- 顺序错误。

Snapshot 与后续 Delta 的交接必须有确定顺序，不能出现订阅瞬间丢失一段内容的竞态。

V1 不要求把每一个 Delta 都写入数据库。

当前运行进程可以持有受边界保护的活动 Turn Buffer，但该 Buffer 只服务于实时观察，不能替代 Turn / Message 的持久化事实。

### 7.5 Turn 完成

正常完成时：

- 非空 Assistant 内容持久化。
- Turn 原子进入 SUCCEEDED。
- finishedAt 等执行信息完成。
- Watcher 收到终态。
- Session 可以开始下一轮。

终态发布不能早于需要持久化的数据完成。

### 7.6 Turn 失败

Provider、Context 构建或执行阶段失败时：

- USER Message 保留。
- 已经产生的非空 Assistant 内容按 Session PRD 规则保留。
- Turn 进入 FAILED。
- Failure 不能回滚已经成立的本轮。
- Failure 不能影响之前的历史 Message。
- FAILED Turn 不作为完整历史进入后续 Context。

### 7.7 用户 Stop

用户显式 Stop 时：

- Stop 针对明确的 turnId。
- 重复 Stop 必须安全。
- 已经产生的非空 Assistant 内容持久化。
- Turn 原子进入 STOPPED。
- 后台模型执行被取消或尽快中止。
- Watcher 收到 STOPPED。
- Session 可以继续下一轮。

Stop 不能依赖某一个 SSE 连接仍然存在。

## 8. 请求幂等

Project 首次创建和后续 Turn 创建都必须具有 Client Request Identity。

同一个逻辑提交在：

- 请求超时。
- 浏览器重试。
- 网络恢复。
- 用户重复点击。
- 前端收到结果前连接中断。

之后再次到达服务端时，不得创建第二份业务数据。

同一个 requestId 的重放必须返回原业务结果。

同一个 requestId 如果被错误地用于不同 Prompt、不同 Session 或不同模型语义，服务端不能静默把两次不同提交当成同一次成功请求，应明确拒绝冲突。

幂等正确性不能依赖 JVM 内存。

数据库唯一边界必须能够处理并发重复请求。

## 9. Streaming 与 Reconnect 契约

### 9.1 Server-owned Stream State

正在 RUNNING 的 Turn 可以存在一个服务端运行时 Stream State，至少包含：

- turnId。
- 当前 Assistant Buffer。
- Watchers。
- terminal signal。

Stream State 的生命周期由 Turn Execution 决定，不由第一个 Watcher 决定。

### 9.2 新 Watcher

新 Watcher 连接一个活动 Turn 时：

1. 先获取当前 Snapshot。
2. 再进入实时 Delta。
3. 最终收到终态。

不能只订阅“从现在开始的新 Delta”，否则刷新后会丢失刷新前已经生成但尚未终态持久化的内容。

### 9.3 Watcher 断开

Watcher 断开必须立即释放：

- listener。
- emitter。
- connection-specific callback。
- timeout resource。

但不能删除仍然属于活动 Execution 的 Stream State。

### 9.4 已终态 Turn

如果 Watcher 连接时 Turn 已经进入终态，服务端应返回可恢复的最终状态，而不是让前端误以为仍然在生成。

前端最终以持久化 Message 和 Turn 终态收敛。

### 9.5 Transport fallback

如果实时 Watcher 暂时不可用，前端可以通过已有状态查询 / changes 机制确认 Turn 是否仍在执行和是否已经进入终态。

Fallback 不能重新创建 Turn。

## 10. 浏览器刷新、断网与多 Tab

### 10.1 刷新

刷新页面后：

- Session 历史重新从持久化数据加载。
- 如果存在活动 Turn，重新 watch 相同 turnId。
- 已经生成的当前 Snapshot 恢复。
- 后续 Delta 继续展示。
- 不重新提交 Prompt。

### 10.2 短暂断网

网络恢复后，客户端重新查询当前 Session / active Turn 状态。

如果原 Turn 仍然活动，则重新建立 Watcher。

如果已经终态，则直接恢复终态和持久化 Assistant Message。

### 10.3 Tab 切换

Tab 进入后台不能被解释为 Stop。

浏览器因为后台策略关闭或暂停连接后，重新激活时走正常 reconnect。

### 10.4 多 Tab

同一用户在多个 Tab 打开同一个 Session 时：

- 可以存在多个 Watcher。
- 只能存在一个真实 Turn Execution。
- 所有 Watcher 最终应收敛到同一个 Turn 状态和 Assistant 内容。
- 任一 Tab 的显式 Stop 都是对该 Turn 的业务 Stop，其他 Tab 最终也应看到 STOPPED。
- 多 Tab 不能因为各自 reconnect 创建新的 Turn。

## 11. 服务异常与 Recovery

PENDING 是可恢复的持久状态，不是 JVM 内存队列。

RUNNING Turn 必须有明确的 stale 判定和恢复机制。

服务异常后允许：

```text
stale RUNNING
  ↓
PENDING
  ↓
same Turn claimed again
  ↓
RUNNING
```

Recovery 必须：

- 继续使用原 Turn。
- 继续使用原 USER Message。
- 继续使用原 Provider / Model identity。
- 不重新更新 Session activity。
- 不创建替代 Turn。
- 不创建第二条 USER Message。

V1 允许服务进程崩溃后重新执行 Provider 调用。

V1 不保证崩溃前尚未持久化的每一个实时 Delta 都能无损恢复。

但最终业务状态必须明确，Turn 不能永久 RUNNING。

## 12. Context 契约

Conversation Infrastructure 不重新定义 Session PRD 的 Context 产品规则。

基础设施必须保证：

- Context 只来自当前 Session。
- Provider 支持的模型必须提供确定的 Context Metadata。
- 当前 Prompt 不被静默截断。
- 历史选择遵循确定规则。
- 超出模型输入能力时明确失败。
- Context 构建失败属于当前 Turn Failure，不影响已持久化 USER Message。
- Context 不能无限加载整个 Session 历史到内存后再无边界处理。

UI Message 分页与 LLM Context 选择是两套独立机制，不能相互绑定。

## 13. 资源边界

Conversation 的所有可增长资源都必须有明确上限或释放条件。

至少包括：

- 单条 Message 大小。
- Streaming Assistant Buffer。
- 单用户并发 Execution。
- 全局并发 Execution。
- SSE Watcher。
- Provider HTTP 连接与超时。
- 数据库连接。
- Recovery 单批处理数量。
- Context Token Budget。
- Message History 页面加载数量。
- 后台执行线程。

单条 Message 的应用层大小边界必须与数据库容量匹配。

当前实现的 Message 大小安全边界可以作为 V1 基线继续存在，但该边界属于配置 / 基础设施限制，不作为产品功能。

Execution 容量满时，已经持久化的 Turn 可以继续保持 PENDING，不能为了排队创建无限内存任务。

不允许业务代码建立无管理的无限线程池或无限队列。

## 14. Error Semantics

Conversation 错误分为两个阶段。

### 14.1 本轮成立前

例如：

- 参数不合法。
- Prompt 超过应用层大小边界。
- requestId 不合法。
- Ownership 不通过。
- USER Message 无法持久化。

此时本轮没有正式成立。

前端应保留用户输入，允许修正或安全重试。

### 14.2 本轮成立后

USER Message 一旦成功持久化，后续错误都属于已经存在的 Turn。

例如：

- Context Too Large。
- Provider Timeout。
- Provider Error。
- Streaming Buffer 超限。
- Recovery Error。

这些错误不能通过删除 USER Message 或重新创建 Turn 来“恢复”。

系统必须让原 Turn 最终进入明确状态。

## 15. Observability

Conversation 的关键日志和指标必须能够回答：

> 哪个用户的哪个请求，在什么 Session / Turn 上，什么时候从什么状态变成了什么状态，为什么失败或恢复。

关键关联字段至少包括：

- requestId。
- userId。
- projectId。
- sessionId。
- turnId。
- provider / model。
- attemptCount。

日志不记录完整 Prompt、完整 Assistant 内容、API Key、Cookie、Token 等敏感信息。

至少需要能够观察：

- Turn PENDING / RUNNING 数量。
- Turn SUCCEEDED / FAILED / STOPPED 数量。
- stale RUNNING Recovery 数量。
- Execution 并发与拒绝数量。
- Provider 调用耗时和错误。
- SSE 活跃连接数。
- Watcher reconnect 数量。
- Turn 创建幂等重放数量。
- Message Size 拒绝数量。
- Context Too Large 数量。

V1 不为了指标数量增加复杂埋点，指标只服务于定位真实问题。

## 16. Acceptance Criteria

### AC-01：成立边界

Given 用户提交一个有效 Prompt  
When USER Message 尚未成功持久化  
Then 该轮不能被视为正式成立  
And 前端保留 Prompt 供用户重试。

### AC-02：幂等提交

Given 同一个 requestId 已经成功建立 Turn  
When 相同逻辑请求再次到达  
Then 返回原 Turn  
And 不新增 Turn  
And 不新增 USER Message  
And 不再次更新 Session activity。

### AC-03：幂等冲突

Given 一个 requestId 已经绑定到一次提交  
When 相同 requestId 被用于不同业务语义  
Then 服务端明确拒绝冲突  
And 不创建或修改 Conversation 数据。

### AC-04：SSE Disconnect 不等于 Stop

Given Turn 正在 RUNNING  
When SSE 连接因为刷新、网络或 timeout 断开  
Then Turn 不进入 STOPPED  
And Provider Execution 不因为该 Watcher 断开自动取消。

### AC-05：刷新继续观察同一 Turn

Given Turn 正在 Streaming  
And 用户已经看到部分 Assistant 内容  
When 浏览器刷新并重新进入 Session  
Then 客户端恢复相同 turnId  
And 先恢复当前 Snapshot  
And 再继续接收后续 Delta  
And 不重新提交 Prompt  
And 不产生重复文本。

### AC-06：短暂断网恢复

Given Turn 正在执行  
When 浏览器短暂断网后恢复  
Then 客户端重新查询当前 Turn  
And 如果仍然活动则重新 Watch 原 Turn  
And 如果已经终态则恢复最终持久化结果。

### AC-07：多 Tab

Given 两个 Tab 打开同一个 Session  
When 同一个 Turn 正在生成  
Then 两个 Tab 可以观察同一个 Turn  
And 后端只有一个真实 Execution  
And 两个 Tab 最终收敛到相同终态和内容。

### AC-08：显式 Stop

Given Turn 正在 Streaming  
When 用户显式 Stop  
Then 非空部分 Assistant 内容被保留  
And Turn 进入 STOPPED  
And 后台 Execution 被取消或终止  
And 重复 Stop 不改变终态。

### AC-09：Failure

Given Provider 在已经输出部分内容后失败  
When Failure 被处理  
Then USER Message 保留  
And 非空部分 Assistant 内容保留  
And Turn 进入 FAILED  
And Session 可以继续下一轮。

### AC-10：终态不可覆盖

Given Turn 已经 SUCCEEDED / FAILED / STOPPED  
When 迟到的 Complete、Failure、Stop 或 Recovery 到达  
Then 原终态保持不变。

### AC-11：服务恢复

Given 服务异常留下 stale RUNNING Turn  
When Recovery 执行  
Then 原 Turn 被恢复为可再次执行状态或明确终态  
And 不创建替代 Turn  
And 不创建第二条 USER Message。

### AC-12：执行容量边界

Given 当前 Execution 容量已经达到限制  
When 新 Turn 已经成功持久化  
Then Turn 保持 PENDING  
And 不进入无限内存队列  
And 后续 Recovery 可以在容量可用时执行它。

### AC-13：Message 边界

Given 用户输入或 Assistant Buffer 超过允许大小  
When 系统检测到超限  
Then 不继续无限增长内存或写入不匹配的数据库字段  
And 当前请求被明确拒绝或当前 Turn 进入 FAILED  
And 已经成立的 USER Message 不被删除。

### AC-14：Context 边界

Given 当前 Prompt 与历史 Context 超过模型能力  
When Context 构建  
Then 优先按既定规则裁剪历史  
And 当前 Prompt 不被静默截断  
And Prompt 本身仍超限时 Turn 明确失败。

### AC-15：Watcher 资源释放

Given 一个 SSE Watcher 断开  
When 连接结束  
Then connection-specific listener / emitter / timeout 被释放  
And 活动 Turn 的 Execution 与 Stream State 按其自身生命周期继续存在。

### AC-16：可追踪

Given 任意一个失败、Stop、恢复或重复提交问题  
When 查看系统日志与指标  
Then 能够通过 requestId / sessionId / turnId 关联到对应 Conversation 生命周期  
And 不需要依赖完整 Prompt 或 Assistant 内容定位状态问题。

## 17. V1 Done 条件

Conversation Infrastructure V1 只有在以下条件全部满足后才能从 Draft 变为 Done：

- 上述 Acceptance Criteria 有明确实现。
- 关键可靠性行为有自动化测试保护。
- 已知实现不存在刷新重新提交 Prompt 的路径。
- 已知实现不存在 SSE Disconnect 自动 Stop 的路径。
- 活动 Turn Reconnect 能恢复当前 Snapshot 并继续观察后续 Delta。
- 幂等、并发、Message Size、Context、Recovery 均存在服务端边界。
- 不存在已知的永久 PENDING / RUNNING 无恢复路径。
- 不存在依赖 JVM 内存保证核心业务唯一性的逻辑。
- 不为了完成 V1 引入没有真实必要的 Redis、MQ、分布式锁或通用任务平台。

## 18. 后续工作方式

本 PRD 完成后，不直接继续增加 Conversation 新功能。

下一步使用本 PRD Review 当前代码，并只记录真实 Gap：

```text
PRD requirement
  ↓
Current implementation
  ↓
Aligned / Missing / Inconsistent / Over-implemented
  ↓
Minimal repair PR
  ↓
Acceptance
```

Review 优先级：

```text
数据丢失
> 重复执行
> 状态错误
> Reconnect / Recovery
> 永久卡死
> 资源泄漏
> 可观测性缺口
> 一般代码质量
```

V1 的目标不是让 Conversation 功能更多。

V1 的目标是：

> 用户已经发出去的消息不会莫名消失，正在生成的回答不会因为浏览器连接变化被误杀，同一个请求不会执行两次，异常发生后系统知道如何回到一个明确状态。
