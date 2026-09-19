# yakable-dao 开发规范

`yakable-dao` 只负责数据库持久化。

固定调用链：

```text
Repository
    ↓
RepositoryImpl
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

5. Repository 是 `yakable-dao` 唯一对外的数据访问入口，具体实现统一放在 `repository.impl`。

6. RepositoryImpl 直接调用 Mapper，不再增加 `Dao`、`DaoImpl`、`Adapter` 等中间层。

7. Repository 接口归 Domain 或 Application 所有，`yakable-dao` 只负责实现，不在 DAO 模块重复定义 Repository 接口。

8. 多张表属于同一个持久化业务操作时，由 RepositoryImpl 直接协调多个 Mapper，不为了拆分而增加新的 DAO 层。

9. Entity、Mapper、MyBatis-Plus 类型禁止泄漏到 Domain、Application 和 HTTP 层。

10. 数据库结构变更统一使用 Flyway 管理，禁止通过业务代码隐式修改数据库结构。

11. 新增持久化代码时优先保持现有结构，不新增 `QueryMapper`、`RepositoryAdapter`、`MybatisXxxRepository` 等重复角色。

## 核心原则

**Entity 对应表，Mapper 对应表，Repository 对应持久化能力。**

**Lambda 能解决的，不写 XML；Lambda 开始难看了，就 Mapper + XML。**

**能少一层，就不要多一层。**
