# Create Project

## 能力

用户从 Dashboard 输入 Prompt、选择模型，创建一个新的 Project，并立即进入它的初始 Session。

## 用户行为

```text
Prompt + Model
→ Create
→ Project 成立
→ 初始 Session / Turn / USER Message 成立
→ 立即进入 Project
→ AI 回答继续异步执行
```

Project 创建成功不等待 Assistant 完整回答。

## 边界

负责：

- Project 创建。
- 自动名称。
- 初始 Session。
- 第一轮 Turn / USER Message。
- 创建请求幂等。
- 创建后导航所需的 Project / Session 信息。

不负责：

- 后续 Turn。
- Streaming UI。
- Stop。
- Context。

## 流程

```text
CreateProjectComposer
→ ProjectService.addProject()
→ POST /api/projects
→ ProjectController
→ ProjectService
→ ProjectRepository
→ create initial Session / Turn / USER Message
→ commit
→ async Turn execution
→ frontend navigate
```

## 代码

Frontend：

```text
yakable-ui/src/features/project/components/CreateProjectComposer.tsx
yakable-ui/src/features/project/hooks/useProjects.ts
yakable-ui/src/service/project/ProjectService.ts
```

Backend：

```text
yakable-boot/src/main/java/io/yakable/boot/controller/project/ProjectController.java
yakable-service/src/main/java/io/yakable/service/project/ProjectService.java
yakable-service/src/main/java/io/yakable/service/project/impl/ProjectServiceImpl.java
```

DAO：

```text
yakable-dao/.../repository/ProjectRepository.java
yakable-dao/.../repository/SessionRepository.java
yakable-dao/.../repository/TurnRepository.java
yakable-dao/.../repository/MessageRepository.java
```

## 测试

重点保护：

- 创建后立即获得 Project + Session。
- 第一次 USER Message 已持久化。
- AI 失败不删除 Project。
- 同一个 requestId 不重复创建。
- 创建成功后前端进入正确 Session。

## 依赖

依赖：

- [Model Selection](../../model/selection/)
- Conversation 的 Turn / Message 基础能力。

产出被 [Recent Projects](../recent-projects/) 使用。
