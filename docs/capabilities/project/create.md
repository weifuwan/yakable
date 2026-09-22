# Create Project

Status: Done
Domain: Project

Depends On:
- [Model Selection](../model/selection.md)
- [Send Message](../conversation/send-message.md)

Related:
- [Recent Projects](./recent-projects.md)

Frontend:
- `yakable-ui/src/features/project/components/CreateProjectComposer.tsx`
- `yakable-ui/src/features/project/hooks/useProjects.ts`
- `yakable-ui/src/service/project/ProjectService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/project/ProjectController.java`
- `yakable-service/src/main/java/io/yakable/service/project/ProjectService.java`
- `yakable-service/src/main/java/io/yakable/service/project/impl/ProjectServiceImpl.java`

Data:
- Project
- Session
- Turn
- Message

Shared Rules:
- PROJ-001
- PROJ-002
- PROJ-003
- PROJ-004
- PROJ-006

Scenarios:
- PROJ-S01

Tests:
- `yakable-ui/src/features/project/components/__tests__/CreateProjectComposer.test.tsx`
- `yakable-ui/src/pages/project/__tests__/ProjectPage.test.tsx`
- `yakable-boot/src/test/java/io/yakable/boot/controller/project/ProjectControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/project/impl/ProjectServiceImplTest.java`
- `yakable-dao/src/test/java/io/yakable/dao/repository/impl/ProjectRepositoryImplTest.java`

## Purpose

从 Dashboard 的第一条 Prompt 创建 Project，并立即进入初始 Session。

## Contract

- 客户端创建请求带稳定 requestId。
- 同一个 requestId 重放返回原 Project。
- Project、首个 Session、首个 Turn、首条 USER Message 一起成立。
- Project 成立不等待 Assistant 完整回答。
- 持久化完成后再启动异步 AI 执行。
- 创建成功返回导航所需的 Project / Session identity。
- 后续 AI Failure / Stop 不删除已经成立的 Project。

## Flow

```text
CreateProjectComposer
→ ProjectService.ts
→ POST /api/projects
→ ProjectController
→ ProjectServiceImpl
→ Project + Session + Turn + USER Message
→ commit
→ async execution
→ navigate to Project / Session
```

## Boundary

Owns:
- Project bootstrap
- create request idempotency
- initial conversation bootstrap
- navigation result

Does Not Own:
- later Turn creation
- Streaming UI
- Stop / Reconnect / Context
