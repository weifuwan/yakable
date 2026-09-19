# Java Backend Architecture

Yakable 后端当前按三层组织：

```text
yakable-boot
    ↓
yakable-service
    ↓
yakable-dao
```

## yakable-boot

负责 Controller、Spring Boot 启动和配置。

```text
io.yakable.boot
├── controller
├── configuration
└── YakableApplication
```

Controller 只负责 HTTP 输入输出和调用 Service。

## yakable-service

负责业务逻辑。

当前只有两个主要业务入口：

```text
io.yakable.service
├── project
│   └── ProjectService
└── session
    └── SessionService
```

原有 Domain、Application、Model、Async 等代码暂时作为
`yakable-service` 内部支撑代码保留，不再拆成独立 Maven module。

后续只有在真实复杂度出现后再决定是否继续拆分。

## yakable-dao

负责数据库持久化。

```text
RepositoryImpl
    ↓
Mapper
    ↓
Entity
    ↓
Database
```

详细规范见 `yakable-dao/README.md`。

## 调用关系

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
RepositoryImpl
    ↓
Mapper
    ↓
Entity
```

## 其他模块

```text
yakable-plugins   # 模型插件
yakable-common    # 通用代码
yakable-bom       # 依赖版本管理
```

## 当前原则

- Controller 放在 `yakable-boot`。
- 业务逻辑统一从 `ProjectService`、`SessionService` 进入。
- 数据库访问统一走 Repository。
- Mapper、Entity 只属于 `yakable-dao`。
- 不为了架构形式新增 Maven module。
- 不为了分层而分层，先保持简单。
- 后续根据真实业务复杂度再拆。
