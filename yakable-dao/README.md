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

## 核心原则

**Entity 对应表，Mapper 对应表，Repository 对应数据访问能力。**

**Lambda 能解决的，不写 XML；Lambda 开始难看了，就 Mapper + XML。**

**能少一层，就不要多一层。**
