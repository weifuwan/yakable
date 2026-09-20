# yakable-dao 开发规范

`yakable-dao` 只负责数据库持久化。

固定调用链：

```text
Service
    ↓
Repository
    ↓
Mapper
    ↓
Entity
```

## 规范

1. 数据库实体统一放在 `entity` 包，类名统一以 `Entity` 结尾，并使用 Lombok，禁止使用 `PO`、`DO` 等命名。

2. 一张物理表只对应一个 Mapper，Mapper 统一放在 `mapper` 包，并继承 MyBatis-Plus `BaseMapper<Entity>`。

3. Lambda 能解决的，不写 XML；Lambda 开始复杂、难读、难维护时，使用 `Mapper + XML`。

4. 禁止在 Mapper 中使用大段 `@Select`、`@Update` 等注解 SQL，复杂 SQL 统一放 XML。

5. Repository 是 `yakable-dao` 唯一对外的数据访问入口，统一放在 `repository` 包。

6. Repository 直接调用 Mapper，不再增加 Repository 接口、`Impl`、`Dao`、`Adapter` 等中间层。

7. Service 只能调用 Repository，不能直接调用 Mapper。

8. 同一业务的数据访问优先收口到一个 Repository，不为了读写、查询、执行再拆多个 Repository。

9. Entity 可以在 Service 内部用于持久化编排，但禁止直接作为 HTTP 返回对象。

10. 数据库结构变更统一使用 Flyway 管理。

11. 新增持久化代码时优先保持现有结构，不新增 `QueryMapper`、`QueryRepository`、`RepositoryAdapter` 等重复角色。

12. 所有数据库时间字段统一使用 `LocalDateTime`，禁止使用 `Date`、`Instant`、`Timestamp` 等其它时间类型。

13. Entity 中不使用 `@TableField` 显式映射普通字段，字段统一使用 Java 驼峰命名，并依赖 MyBatis-Plus 的下划线转驼峰规则。

14. 所有 Entity 统一继承 `BaseEntity`，公共字段不在每个 Entity 中重复定义。

15. `BaseEntity` 统一包含以下字段：

```text
id
createTime
updateTime
createBy
updateBy
```

16. `BaseEntity` 提供 `initCreate` 和 `initUpdate` 方法：

- `initCreate`：初始化 ID、创建时间、更新时间、创建人、更新人。
- `initUpdate`：初始化更新时间和更新人。

17. ID 统一通过公共 Utils 生成，使用雪花算法；禁止在业务代码中直接使用 `UUID` 或各自实现 ID 生成逻辑。

18. 需要表达固定状态、类型时必须定义枚举类，不直接在业务代码中散落魔法值。

19. 枚举持久化到数据库时统一保存数字值，例如 `0`、`1`、`2`，不直接保存枚举名称字符串。

20. 分页查询统一使用 MyBatis-Plus 的 `Page / IPage`，禁止在 Service 中手动计算 `total`、`offset`、`pages`。

21. Repository 负责创建 MyBatis-Plus `Page` 并调用 Mapper，Service 只接收统一的 `PageData`，不感知 MyBatis-Plus 分页实现。

22. 复杂分页查询可以继续使用 `Mapper + XML`，但 XML 中不手写 `LIMIT / OFFSET`，由 MyBatis-Plus 分页插件统一处理；总数统计也交给分页插件。

## 核心原则

**Entity 对应表，Mapper 对应表，Repository 对应数据访问能力。**

**公共字段放 BaseEntity，公共能力只实现一次。**

**分页能力交给 MyBatis-Plus，Service 不处理数据库分页细节。**

**数据库值保持简单稳定，业务语义通过枚举表达。**
