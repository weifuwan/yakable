# Project Domain

Product:
- [Project](../../product/project.md)

## Graph

```text
Create Project
     ↓
Project + initial Session / Turn
     ↓
Initial Code Generation
     ↓
Project Files + Turn Terminal
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

### PROJ-007 — File Isolation

一个 Project 的文件操作只能发生在自己的 Project Root 内；Project ID、文件路径或生成内容都不能访问其他 Project 或 Project Root 之外的文件。

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
- Conversation / Stop
- Conversation / Recovery

Guarantees:
- Project 创建时已经建立的首个 Turn 同时作为 Initial Code Generation Turn，不创建第二个生成 Turn。
- 同一个 Initial Turn 不能由两条执行链重复触发两个有效的代码生成执行。
- Project 先成立，再执行代码生成；Generation Failure / Stop 不删除已经成立的 Project。
- 每个 Project 的文件只能发布到自己的 Project Root。
- Generation Result 只有完整解析、校验并发布后才对 Project 生效，失败不能留下可见的部分项目文件。
- Project Files 完整发布成功后，Initial Turn 才能进入 SUCCEEDED。
- Initial Turn Retry / Recovery 复用原 Turn；已成功发布的结果不能被重复生成覆盖。
- Initial Turn 进入 STOPPED / FAILED 后，迟到结果不能继续发布项目文件。
