# Yakable Backend Map

后端当前只需要记住三层：

```text
Controller -> Service -> DAO
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
├── project/ProjectService.java
└── session/SessionService.java
```

修改 Project 业务，从 `ProjectService` 开始。

修改 Session / Turn / Message 业务，从 `SessionService` 开始。

模型调用、Turn 执行、异步恢复等支撑代码也暂时放在
`yakable-service`，按需再继续读取。

## DAO

```text
yakable-dao/src/main/java/io/yakable/dao/
├── entity
├── mapper
├── repository/impl
├── transaction
└── config
```

数据库操作从对应 RepositoryImpl 开始。

DAO 规范见：

```text
yakable-dao/README.md
```

## Model Plugin

```text
yakable-plugins/yakable-plugin-model/
```

只有模型 Provider、协议、配置相关问题才进入插件代码。

## Boot Configuration

```text
yakable-boot/src/main/java/io/yakable/boot/configuration/
```

Bean 装配和运行时配置在这里处理。

## Context Rule

默认不要扫描整个后端。

```text
HTTP 问题
-> Controller
-> 对应 Service

业务问题
-> ProjectService / SessionService

数据库问题
-> Service
-> RepositoryImpl
-> Mapper / Entity

模型问题
-> Service 内 Model/Turn 支撑
-> Plugin
```

先读最少的代码，不够再扩。
