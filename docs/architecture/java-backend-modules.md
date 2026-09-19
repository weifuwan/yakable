# Java Backend Architecture

Yakable 后端只保留三层：

```text
yakable-boot
    ↓
yakable-service
    ↓
yakable-dao
```

## yakable-boot

负责：

- Controller
- Spring Boot 启动
- Bean 配置
- 运行时配置

Controller 只调用 Service。

## yakable-service

负责业务逻辑。

```text
io.yakable.service
├── project
│   └── ProjectService
├── session
│   └── SessionService
├── model
│   └── ModelClient
└── turn
    ├── TurnExecutor
    ├── TurnDispatcher
    └── TurnRecoveryWorker
```

详细规范见 `yakable-service/README.md`。

## yakable-dao

负责数据库访问。

```text
io.yakable.dao
├── repository
│   ├── ProjectRepository
│   └── SessionRepository
├── mapper
├── entity
└── config
```

详细规范见 `yakable-dao/README.md`。

## 固定调用链

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

## 原则

- 不为了分层而分层。
- 不提前创建 Port、Gateway、Adapter、Manager、UseCase。
- 一个领域优先一个 Service。
- 一个领域的数据访问优先一个 Repository。
- 复杂度真实出现后再拆。
