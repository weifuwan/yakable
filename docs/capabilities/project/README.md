# Project

> 产品定义：[Project](../../product/project.md)

Project 是用户长期工作的容器，不代表一次 AI 执行。

当前由两个主要能力块组成：

```text
Create Project
     ↓
Project + initial Session + first Turn
     ↓
Recent Projects
     ↓
re-open latest Session
```

- [Create Project](./create/README.md)
- [Recent Projects](./recent-projects/README.md)

## 代码总入口

Frontend：

```text
yakable-ui/src/features/project/
yakable-ui/src/service/project/
```

Backend：

```text
yakable-boot/.../controller/project/ProjectController.java
yakable-service/.../project/ProjectService.java
yakable-service/.../project/impl/ProjectServiceImpl.java
yakable-dao/.../repository/ProjectRepository.java
```

Project 不负责 Session 内部 Streaming、Stop、History 和 Context，这些进入 [Conversation](../conversation/)。
