# Session

Status: Done

Domain:
- [Conversation](../capabilities/conversation/)

## Contract

Session 是 Project 中持续进行的一段对话。

V1 中：

- 每个 Project 只有一个 Session。
- Session 本身没有 ACTIVE / CLOSED / ARCHIVED 生命周期状态。
- 单轮执行状态属于 Turn。
- Turn 表示一次用户提交形成的一轮执行。
- Message 是需要长期保存的对话内容。
- USER Message 成功持久化后，本轮才正式成立。
- Turn 创建时固定本轮 provider / model。
- Session 中保存的模型只表示下一轮默认选择。
- 同一 Session 同时最多一个 PENDING / RUNNING Turn。
- SUCCEEDED / FAILED / STOPPED 是互斥终态。
- Stop / Failure 时已经产生的非空 Assistant 内容保留。
- 页面刷新或网络断开不能自动 Stop Turn。
- 重新进入 Session 时恢复同一个活动 Turn，不重新提交 Prompt。
- 历史 Message 首屏有界加载，更早内容按需分页。
- UI History 与 LLM Context 是两套独立机制。
- 当前 Prompt 不能为了历史 Context 被静默截断。

## Boundary

V1 不包含：

- 第二个 Session。
- Session 列表 / 切换。
- Message Edit / Delete / Regenerate。
- 对话 Branch。
- Agent / Tool / Workflow。
- 跨 Session Memory。
