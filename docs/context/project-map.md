# Yakable Project Map

## Backend

| Path | Responsibility |
| --- | --- |
| `yakable-boot/` | Controller、启动、配置 |
| `yakable-service/` | Project / Session 业务逻辑 |
| `yakable-dao/` | Repository、Mapper、Entity、Flyway |
| `yakable-plugins/` | 模型 Provider |
| `yakable-common/` | 通用代码 |

后端固定调用链：

```text
Controller -> Service -> Repository -> Mapper -> Entity
```

常见入口：

```text
Project
-> yakable-service/.../project/ProjectService.java

Session / Turn / Message
-> yakable-service/.../session/SessionService.java

Model
-> yakable-service/.../model/ModelClient.java

Turn execution
-> yakable-service/.../turn/

Database
-> yakable-dao/.../repository/
```

## Frontend

```text
yakable-ui/src/
├── app/
├── features/
├── pages/
└── shared/
```

Frontend Harness 资产：

```text
templates/base/
templates/packs/
docs/architecture/frontend-domain-harness.md
```

## Context rule

先从最小入口开始，不默认扫描整个仓库。
