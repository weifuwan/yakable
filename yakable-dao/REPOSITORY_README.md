# Repository 开发规范

通用 Java 规则遵循根目录 `JAVA_GLOBAL_CODE_README.md`。

## 职责

1. Repository 是 DAO 唯一对外数据访问入口。一张业务表对应一个 Repository，Repository 只访问本表 Mapper；跨表业务由 Service 编排。

2. Service 只能直接依赖本表 Repository 接口，禁止依赖其他表 Repository、RepositoryImpl、BaseRepository 或 Mapper。

## 结构

3. 每张表使用 `XxxRepository + repository.impl/XxxRepositoryImpl`。接口继承 `BaseRepository<Entity>`，Impl 继承 `BaseRepositoryImpl<Mapper, Entity>`，使用 `@Repository`，并通过 `@Resource` 只注入本表 Mapper。

4. `BaseRepository` 已提供的 add、deleteById、update、queryById、queryList、queryCount、queryPage 直接使用，禁止在领域 Repository 重复声明或做无意义转发。

5. 只有基础能力无法表达本表数据访问语义时才新增专属方法，统一使用 `add / delete / update / query + 领域名` 命名。

## Mapper / SQL

6. MyBatis-Plus Lambda 能清晰完成的直接使用；复杂查询使用 `Mapper + XML`。禁止在 Mapper 中堆大段 `@Select / @Update` SQL，也禁止手写框架已有 CRUD、分页、自增自减能力。

## Update

7. 普通按 ID 更新使用基础 update；条件更新使用 `LambdaUpdateWrapper`。状态流转必须在同一 SQL 中同时限制当前状态并更新目标状态，禁止“先查再改”。

8. Update 只修改当前状态流转需要变化的字段；仅重置、回滚、恢复等明确场景才显式清空旧值。审计字段统一交给 MyBatis-Plus 自动填充。

## 分页

9. 分页统一使用 MyBatis-Plus `Page / IPage`，Repository 返回统一 `PageData`；禁止手算 total、offset、pages，XML 不手写 LIMIT / OFFSET。
