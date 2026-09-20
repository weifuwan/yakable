# Repository 开发规范

1. Repository 是 `yakable-dao` 唯一对外的数据访问入口，统一放在 `repository` 包。

2. 每个领域 Repository 统一拆成接口和实现类：接口命名为 `XxxRepository`，实现类命名为 `XxxRepositoryImpl`。

3. Service 只依赖 Repository 接口，禁止依赖 `XxxRepositoryImpl`，也不能直接调用 Mapper。

4. Repository 实现类统一放在 `repository.impl` 包，使用 `@Repository`，并实现对应的 Repository 接口。

5. Repository 接口中的所有公开方法必须写必要注释；实现类中对应的实现方法不重复写相同注释。

6. 同一业务的数据访问优先收口到一个 Repository，不为了读写、查询、执行再拆多个 Repository。

7. Repository 实现类依赖注入统一使用 `@Resource`，不手写仅用于依赖注入的构造方法。

8. Repository 对外的增删改查方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名，例如 `addProject`、`deleteProject`、`updateProject`、`queryProject`。

9. Repository 对外不使用含义模糊的 `save`、`find`、`get` 作为核心方法名；新增和修改明确区分，新增直接 insert，修改直接 update。

10. Repository 不重复做 Service / DTO 已完成的参数判空，不写没有实际意义的 `Objects.requireNonNull`。

11. Repository 隐藏 MyBatis-Plus、Mapper、XML 等持久化细节，Service 只看到 Entity、DTO、PageData 等项目自己的类型。

12. DAO 提供统一的抽象 `BaseRepository<M, T>`，封装基于 MyBatis-Plus `BaseMapper` 的基础能力，例如新增、删除、更新、按 ID 查询、列表查询、数量查询和简单分页。

13. `BaseRepository` 只提供 DAO 内部可复用的基础方法，不作为 Service 层接口使用，也不引入 MyBatis-Plus `IService` / `ServiceImpl`。

14. 领域 Repository 接口只声明当前领域真正对外的数据访问能力；`XxxRepositoryImpl` 继承 `BaseRepository` 后复用基础方法，并实现领域接口。

15. `BaseRepository` 的通用方法使用简短通用命名，例如 `add`、`deleteById`、`update`、`queryById`、`queryList`、`queryCount`、`queryPage`；这些方法只在 Repository 实现内部使用，不直接暴露给 Service。

16. 分页查询统一使用 MyBatis-Plus 的 `Page / IPage`，禁止在 Service 中手动计算 `total`、`offset`、`pages`。

17. Repository 实现负责创建 MyBatis-Plus `Page` 并调用 Mapper，Service 只接收统一的 `PageData`，不感知 MyBatis-Plus 分页实现。

18. 复杂分页查询可以继续使用 `Mapper + XML`，但 XML 中不手写 `LIMIT / OFFSET`，由 MyBatis-Plus 分页插件统一处理；总数统计也交给分页插件。

19. 简单方法声明和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行。
