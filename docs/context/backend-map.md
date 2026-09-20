# Yakable Backend Map

后端只需要记住：

```text
Controller -> Service -> Repository
```

## Controller

```text
yakable-boot/src/main/java/io/yakable/boot/controller/
├── project/ProjectController.java
├── session/SessionController.java
└── RestExceptionHandler.java
```

## Service

```text
yakable-service/src/main/java/io/yakable/service/
├── project/
│   ├── ProjectService.java
│   └── impl/ProjectServiceImpl.java
├── session/
│   ├── SessionService.java
│   └── impl/SessionServiceImpl.java
├── message/
│   ├── MessageService.java
│   └── impl/MessageServiceImpl.java
├── turn/
│   ├── TurnService.java
│   └── impl/TurnServiceImpl.java
└── model/ModelClient.java
```

Project 问题从 `ProjectService` 开始。

Session、Turn 执行与恢复问题从 `SessionService` 开始。

Turn 状态与数据能力从 `TurnService` 开始。

模型调用问题再进入 `ModelClient`。

## DAO

```text
yakable-dao/src/main/java/io/yakable/dao/
├── repository/
│   ├── ProjectRepository.java
│   └── SessionRepository.java
├── mapper/
├── entity/
└── config/
```

数据库问题从 Repository 开始，不直接从 Mapper 开始。

## Context rule

默认只加载：

```text
Controller
+ 对应 Service
+ 对应 Repository
```

只有问题确实涉及 SQL、模型调用或 Turn 执行时，再继续向下扩。
