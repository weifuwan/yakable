# Project

Status: Done

Capabilities:
- [Create Project](../capabilities/project/create.md)
- [Project Code Generation](../capabilities/project/code-generation.md)
- [Recent Projects](../capabilities/project/recent-projects.md)

## Contract

Project 是用户长期工作的容器。

V1 中：

- Project 属于创建它的用户。
- 创建 Project 时自动建立首个 Session、首个 Turn 和首条 USER Message。
- Project 创建成功不等待 Assistant 完整回答。
- AI 后续失败不能删除已经成立的 Project。
- 同一个客户端创建请求必须幂等。
- 一个 Project 当前只有一个 Session。
- Project 列表按最近用户活动展示。
- 新 USER Message 成立后更新 Project 的最近活动，不等待 Assistant 完成。

## Boundary

Project 不负责：

- Session 内部 Streaming。
- Stop / Reconnect / Recovery。
- Message History。
- LLM Context。
- Agent / Tool / Workflow。

这些能力进入对应 Capability。
