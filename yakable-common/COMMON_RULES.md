# Common Rules

Scope:
- `yakable-common/**`

Depends On:
- `/JAVA_RULES.md`
- 公共行为变化时加载 `/BACKEND_TEST_RULES.md`

Owns:
- 跨模块 DTO / VO
- 公共枚举与常量
- 公共错误契约
- 公共工具
- 通用 API Contract

## Must

- DTO 放在 `bean.dto.<domain>`。
- VO 放在 `bean.vo.<domain>`。
- 领域枚举放在 `enums.<domain>`。
- 真正跨领域对象放 `common` 子包。
- DTO 按操作和领域命名，纯分页复用公共分页 DTO。
- VO 按对外业务语义命名，不按数据库表机械命名。
- 字符串、JSON、转换、时间、ID、线程等跨模块能力集中复用。
- 时间统一使用 `LocalDateTime`。
- 需要持久化的枚举通过 `@EnumValue` 保存数字值。
- 公共常量放 `constant`。
- 同一领域只维护一套错误码 / 异常契约。
- 对外 DTO / VO 使用 Swagger 3 `@Schema` 描述业务字段。
- 必填、长度、范围用 Jakarta Validation 表达。

## Must Not

- 在 Common 放具体业务编排。
- 在其他模块重复实现已有公共工具。
- 多模块重复定义同一语义的常量、枚举或错误契约。
- 在 API 描述中暴露 Entity / Mapper / Repository 实现细节。
- 在 `@Schema` description 中重复维护 Validation 规则。

## Boundary

Common 只承载跨模块稳定对象和能力；领域行为属于 Service 或对应运行时模块。
