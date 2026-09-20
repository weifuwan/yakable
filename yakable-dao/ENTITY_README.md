# Entity 开发规范

1. 数据库实体统一放在 `entity` 包，类名统一以 `Entity` 结尾，并使用 Lombok，禁止使用 `PO`、`DO` 等命名。

2. Entity 可以在 Service 内部用于持久化编排，但禁止直接作为 HTTP 返回对象。

3. 所有数据库时间字段统一使用 `LocalDateTime`，禁止使用 `Date`、`Instant`、`Timestamp`。

4. Entity 中不使用 `@TableField` 显式映射普通字段，字段使用 Java 驼峰命名，并依赖 MyBatis-Plus 下划线转驼峰规则。

5. 所有 Entity 统一继承 `BaseEntity`，公共字段不在每个 Entity 中重复定义。

6. `BaseEntity` 统一包含：

```text
id
createTime
updateTime
createBy
updateBy
```

7. `BaseEntity` 提供：

- `initCreate`：初始化 ID、创建时间、更新时间、创建人、更新人。
- `initUpdate`：初始化更新时间和更新人。

8. ID 统一通过公共 Utils 使用雪花算法生成，禁止业务代码直接使用 `UUID` 或自行实现 ID 生成逻辑。

9. 需要表达固定状态、类型时必须定义枚举，不在业务代码中散落魔法值。

10. 枚举持久化到数据库时统一保存数字值，例如 `0`、`1`、`2`，不保存枚举名称字符串。

11. Entity 中的状态、类型字段直接使用枚举类型，不定义为 `Integer` 后再手动转换。

12. 枚举使用 MyBatis-Plus `@EnumValue` 标记数据库值，由 `MybatisEnumTypeHandler` 自动完成“枚举 ↔ 数字”转换。

13. Service、Repository 直接使用枚举本身，不调用 `getValue()` 操作数据库值。


## 注释规范

14. 每个 Entity 类必须有中文类注释，类注释必须与对应 Flyway 建表语句中的表 `COMMENT` 保持一致。

15. 每个持久化字段必须有中文字段注释，字段注释必须与 Flyway 中对应列的 `COMMENT` 完全一致；禁止 Entity 和数据库分别维护两套不同文案。

16. `BaseEntity` 中的公共字段只在 `BaseEntity` 中维护注释，但所有业务表中对应公共列的 `COMMENT` 必须统一使用相同文案：

```text
id         -> 主键ID
createTime -> 创建时间
updateTime -> 更新时间
createBy   -> 创建人ID
updateBy   -> 更新人ID
```

17. 枚举字段的 Entity 注释必须像 Flyway 一样完整写明每个数字值的业务含义，例如：

```text
执行轮次状态：0-待执行，1-执行中，2-成功，3-失败
```

禁止只写“状态”“类型”等缺少取值说明的注释。

18. 修改 Flyway 字段 `COMMENT` 时，必须在同一个变更中同步修改对应 Entity 注释；修改 Entity 字段业务语义时，也必须同步检查数据库 `COMMENT`，保证两边长期一致。
