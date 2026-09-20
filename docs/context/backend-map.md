# Yakable Backend Map

后端主业务只需要记住：

```text
Controller -> Service -> Repository
```

## Controller

```text
yakable-boot/src/main/java/io/yakable/boot/controller/
├── project/ProjectController.java
└── session/SessionController.java
```

## Service

```text
yakable-service/src/main/java/io/yakable/service/
├── project/
├── session/
├── message/
├── turn/
└── llm/PluginLlmClient.java
```

Project 问题从 `ProjectService` 开始。

Session、Turn 执行与恢复问题从 `SessionService` 开始。

Turn 状态与数据能力从 `TurnService` 开始。

## Core / LLM

```text
yakable-core/src/main/java/io/yakable/core/llm/
├── LlmClient.java
├── LlmProvider.java
├── LlmRequest.java
├── LlmResponse.java
├── LlmMessage.java
├── LlmUsage.java
└── LlmProviderConfiguration.java
```

LLM 输入、输出和 Provider 边界问题从 `yakable-core/llm` 开始。

Provider 发现和运行时配置再看 `PluginLlmClient`。

具体 Provider / HTTP 协议问题最后进入 `yakable-plugins`。

## DAO

```text
yakable-dao/src/main/java/io/yakable/dao/
├── repository/
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

涉及 LLM 时增加：

```text
yakable-core/llm
```

只有问题确实涉及 Provider 或 HTTP 协议时，再继续加载 Model Plugin。
