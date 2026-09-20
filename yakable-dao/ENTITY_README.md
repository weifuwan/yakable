# Entity 开发规范

通用 Java 规则遵循根目录 `JAVA_GLOBAL_CODE_README.md`。

1. Entity 统一放 `entity` 包并以 `Entity` 结尾，禁止使用 PO、DO；Entity 可用于内部持久化编排，禁止直接作为 HTTP 返回对象。

2. 所有 Entity 继承 `BaseEntity`。公共字段统一为 `id / createTime / updateTime / createBy / updateBy`，创建和更新分别通过 `initCreate / initUpdate` 初始化。

3. 数据库时间字段统一使用 `LocalDateTime`；普通字段使用 Java 驼峰命名并依赖 MyBatis-Plus 下划线映射，不为普通字段重复写 `@TableField`。

4. ID 统一通过 Common 的 ID 能力生成，禁止业务代码直接使用 UUID 或自建 ID 方案。

5. 固定状态、类型使用枚举；Entity 字段直接使用枚举类型。持久化枚举使用 `@EnumValue` 保存数字值，禁止保存枚举名称或在业务代码手动操作数据库值。

6. Entity 类和持久化字段必须有中文注释，并与 Flyway 的表、字段 `COMMENT` 保持一致；枚举字段注释必须写清每个数字值含义。

7. 修改数据库字段语义或 `COMMENT` 时，同一变更中同步检查和修改 Entity 注释，禁止维护两套不同文案。
