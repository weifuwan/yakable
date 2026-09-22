# Entity Rules

Scope:
- `yakable-dao/src/main/java/**/entity/**`

Depends On:
- `/JAVA_RULES.md`
- `/yakable-common/COMMON_RULES.md`
- `./FLYWAY_RULES.md`

Owns:
- Java 持久化模型
- 表到对象映射

## Must

- Entity 放在 `entity` 包并以 `Entity` 结尾。
- 所有 Entity 继承 `BaseEntity`。
- 公共字段统一 `id / createTime / updateTime / createBy / updateBy`。
- 创建 / 更新审计字段通过 `initCreate / initUpdate` 初始化。
- 数据库时间字段使用 `LocalDateTime`。
- 普通字段使用 Java 驼峰并依赖 MyBatis-Plus 下划线映射。
- ID 统一通过 Common ID 能力生成。
- 固定状态 / 类型使用枚举。
- 持久化枚举通过 `@EnumValue` 保存数字值。
- Entity 类和持久化字段使用中文注释，并与 Flyway 表 / 字段 `COMMENT` 一致。
- 枚举字段注释必须写清每个数字值语义。
- 字段语义变化时同步修改 Entity 注释和 Flyway COMMENT。

## Must Not

- 使用 PO / DO 命名。
- 直接把 Entity 作为 HTTP 返回对象。
- 为普通下划线映射重复写 `@TableField`。
- 在业务代码直接用 UUID 或自建 ID 方案。
- Schema 已约定数字枚举时保存枚举名称。
- 在业务代码手工转换数据库枚举值。

## Boundary

Entity 只镜像持久化语义；API 形状属于 VO；业务行为属于 Service。
