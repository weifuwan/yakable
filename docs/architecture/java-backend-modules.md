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

负责 Controller、Spring Boot 启动、Bean 装配和运行时配置。

## yakable-service

负责业务逻辑，详细规范见 `yakable-service/SERVICE_README.md`。

## yakable-core

负责 Yakable 自己定义的稳定运行时契约，详细规范见 `yakable-core/CORE_README.md`。

## yakable-common

负责跨模块公共对象和公共能力，详细规范见 `yakable-common/COMMON_CODE.md`。

## yakable-dao

负责数据库持久化：

- `ENTITY_README.md`
- `REPOSITORY_README.md`
- `FLYWAY_README.md`

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

- 所有 Java 代码先遵循根目录 `JAVA_GLOBAL_CODE_README.md`。
- 模块规范只补充模块边界，不重复维护通用规则。
- 复杂度真实出现后再拆。
