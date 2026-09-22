# Repository Rules

Scope:
- `yakable-dao/src/main/java/**/repository/**`
- `yakable-dao/src/main/java/**/mapper/**`
- Repository Mapper XML

Depends On:
- `/JAVA_RULES.md`
- `/BACKEND_TEST_RULES.md`
- `./ENTITY_RULES.md`
- `./FLYWAY_RULES.md`

Owns:
- 数据访问
- 查询 / 更新持久化语义
- Mapper SQL

## Must

- Repository 是 DAO 唯一对外数据访问入口。
- 一张业务表对应一个 Repository 边界。
- Repository 只访问本表 Mapper。
- 使用 `XxxRepository + repository.impl/XxxRepositoryImpl`。
- 接口继承 `BaseRepository<Entity>`，Impl 继承 `BaseRepositoryImpl<Mapper, Entity>`。
- Impl 使用 `@Repository`，通过 `@Resource` 只注入本表 Mapper。
- 直接复用 BaseRepository 的 `add / deleteById / update / queryById / queryList / queryCount / queryPage`。
- 只有基础能力无法表达本表数据语义时才增加专属方法。
- 专属方法使用 `add / delete / update / query + 领域名`。
- 简单查询优先 MyBatis-Plus Lambda。
- 复杂查询使用 Mapper + XML。
- 条件更新使用 `LambdaUpdateWrapper`。
- 状态流转必须在一条 SQL 中同时限制当前状态并更新目标状态。
- Update 只修改当前流转需要变化的字段。
- 审计字段交给 MyBatis-Plus 自动填充。
- 分页使用 MyBatis-Plus `Page / IPage`，Repository 返回公共 `PageData`。

## Must Not

- Service 直接依赖 Mapper、RepositoryImpl 或 BaseRepository。
- 一个 Repository 编排多个业务表。
- 重复声明 BaseRepository 已有方法做无意义转发。
- 能用 XML 更清楚表达时在 Mapper 堆大段 `@Select / @Update`。
- 重写框架已有 CRUD、分页、自增自减能力。
- 用“先查再改”实现状态流转。
- 没有 reset / rollback / recovery 语义时主动清空旧值。
- 手算 total、offset、pages。
- 普通分页在 XML 手写 LIMIT / OFFSET。

## Tests

自定义查询、更新、XML、事务和数据库特性按 `BACKEND_TEST_RULES.md` 验证；真实持久化语义优先 MySQL Testcontainers。

## Boundary

Repository 只拥有单表持久化行为；跨表业务编排属于 Service。
