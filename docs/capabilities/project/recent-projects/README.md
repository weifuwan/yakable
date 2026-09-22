# Recent Projects

## 能力

让用户从侧边栏快速找回最近工作的 Project，并直接进入其最近活动 Session。

## 用户行为

```text
login / dashboard
→ load recent projects
→ scroll to load more
→ click project
→ enter latest Session
```

新的 USER Message 成立后，对应 Project 可以立即移动到更靠前的位置，不等待 Assistant 完成。

## 边界

负责：

- Project 列表。
- 最近活动排序。
- 分页追加。
- 打开 Project。

不负责：

- Session 历史消息。
- AI 执行状态。
- Project 搜索 / 标签 /文件夹。

## 代码

Frontend：

```text
yakable-ui/src/features/project/components/RecentProjects.tsx
yakable-ui/src/features/project/context/ProjectsProvider.tsx
yakable-ui/src/features/project/hooks/useProjects.ts
yakable-ui/src/service/project/ProjectService.ts
```

Backend：

```text
ProjectController.queryProject()
ProjectService.queryProject()
ProjectRepository
```

## 测试

```text
RecentProjects.test.tsx
ProjectsProvider.test.tsx
```

保护分页、排序、加载失败重试和 Session activity 后的列表更新。

## 依赖

依赖 Project activity 语义。

Conversation 在 USER Message 持久化后向 Project 层报告 activity。
