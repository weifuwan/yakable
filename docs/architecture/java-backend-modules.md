# Java Backend Architecture

Yakable 主业务链保持：

```text
yakable-boot
    ↓
yakable-service
    ↓
yakable-dao
```

LLM 等稳定运行时契约放在独立 Core：

```text
yakable-service ──→ yakable-core
model plugins ───→ yakable-core
```

## yakable-boot

负责：

- Controller
- Spring Boot 启动
- Bean 配置
- 运行时配置
- 组装内置 Model Plugin

Controller 只调用 Service。

## yakable-service

负责业务逻辑。

```text
io.yakable.service
├── project
├── session
├── message
├── turn
└── llm
    └── PluginLlmClient
```

Service 只通过 `yakable-core` 的 LLM 契约调用模型，不直接依赖 Model Plugin API。

详细规范见 `yakable-service/README.md`。

## yakable-core

负责 Yakable 自己定义的稳定运行时契约。

当前：

```text
io.yakable.core
└── llm
    ├── LlmClient
    ├── LlmProvider
    ├── LlmRequest
    ├── LlmResponse
    ├── LlmMessage
    ├── LlmUsage
    └── LlmProviderConfiguration
```

具体 Provider 不能反向定义 Core 的输入输出结构。

详细说明见 `yakable-core/README.md`。

## yakable-dao

负责数据库访问。

```text
io.yakable.dao
├── repository
├── mapper
├── entity
└── config
```

详细规范见 `yakable-dao/README.md`。

## 固定业务调用链

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Mapper
    ↓
Entity
```

LLM 调用链：

```text
Service
    ↓
LlmClient
    ↓
LlmProvider
    ↓
Provider / Protocol implementation
```

## 原则

- 不为了分层而分层。
- 一个领域优先一个 Service。
- 一个领域的数据访问优先一个 Repository。
- Core 只定义稳定契约，不承载业务编排。
- Provider 适配外部模型，不把外部协议泄露给 Service。
- 复杂度真实出现后再拆。
