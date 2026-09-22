# Recent Projects

Status: Done
Domain: Project

Depends On:
- [Create Project](./create.md)

Related:
- [Send Message](../conversation/send-message.md)

Frontend:
- `yakable-ui/src/features/project/components/RecentProjects.tsx`
- `yakable-ui/src/features/project/context/ProjectsProvider.tsx`
- `yakable-ui/src/features/project/hooks/useProjects.ts`
- `yakable-ui/src/service/project/ProjectService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/project/ProjectController.java`
- `yakable-service/src/main/java/io/yakable/service/project/ProjectService.java`
- `yakable-service/src/main/java/io/yakable/service/project/impl/ProjectServiceImpl.java`

Data:
- Project
- Session Activity

Shared Rules:
- PROJ-001
- PROJ-005

Scenarios:
- PROJ-S02

Tests:
- `yakable-ui/src/features/project/components/__tests__/RecentProjects.test.tsx`
- `yakable-ui/src/features/project/context/__tests__/ProjectsProvider.test.tsx`
- `yakable-boot/src/test/java/io/yakable/boot/controller/project/ProjectControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/project/impl/ProjectServiceImplTest.java`

## Purpose

让用户快速找回最近工作的 Project，并进入其当前 Session。

## Contract

- 只返回当前用户拥有的 Project。
- 按最近用户活动排序。
- 支持分页追加，不一次加载全部 Project。
- 新 USER Message 成立后可以立即更新对应 Project 的 activity。
- Assistant Success / Failure / Stop 不再次改变 activity。
- 点击 Project 进入其当前 / 最近 Session。

## Flow

```text
Dashboard / sidebar
→ ProjectsProvider
→ ProjectService.queryProject
→ GET /api/projects
→ ProjectController
→ ProjectServiceImpl
→ ordered page
→ RecentProjects
```

## Boundary

Owns:
- recent project list
- activity ordering
- pagination
- project navigation

Does Not Own:
- Session history
- AI execution state
- project search / tags / folders
