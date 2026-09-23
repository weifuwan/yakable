# Project Domain

Product:
- [Project](../../product/project.md)

## Graph

```text
Create Project
     ↓
Project + initial Session
     ↓
Initial Code Generation
     ↓
Recent Projects
```

Capabilities:

- [Create Project](./create.md)
- [Project Code Generation](./code-generation.md)
- [Recent Projects](./recent-projects.md)

## Shared Rules

### PROJ-001 — Ownership

Project 只属于创建它的用户；Project ID 本身不能绕过 ownership。

### PROJ-002 — Bootstrap

Project 创建成功时，首个 Session、Turn 和 USER Message 必须一起成立。

### PROJ-003 — Create Idempotency

同一个 create requestId 重放必须返回原 Project，不能创建第二份业务数据。

### PROJ-004 — Failure Isolation

Project 已成立后，后续 AI Failure / Stop 不能删除或回滚 Project。

### PROJ-005 — Activity

Project 最近活动由新的 USER Message 成立驱动，不等待 Assistant 完成。

### PROJ-006 — Single Session V1

V1 一个 Project 只有一个 Session。

## Cross-Capability Scenarios

### PROJ-S01 — Create → Initial Conversation

Involves:
- Create Project
- Conversation / Send Message

Guarantees:
- Project、Session、Turn、USER Message 一次建立。
- 创建成功后立即可导航。
- AI 执行在持久化事务之后开始。

### PROJ-S02 — New User Message → Recent Activity

Involves:
- Conversation / Send Message
- Recent Projects

Guarantees:
- USER Message 持久化后更新 activity。
- Recent Projects 可以立即反映最新活动。
- Assistant Success / Failure 不再次改变 activity。

### PROJ-S03 — Create → Initial Code Generation

Involves:
- Create Project
- Project Code Generation

Guarantees:
- Project 先成立，再执行代码生成。
- 每个 Project 的文件只能写入自己的项目目录。
- Generation Failure 不删除已经成立的 Project。
- Generation Success 后项目文件真实存在。
