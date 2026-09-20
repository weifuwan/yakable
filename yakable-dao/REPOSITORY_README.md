# Repository 开发规范

1. Repository 是 `yakable-dao` 唯一对外的数据访问入口，统一放在 `repository` 包。

2. 每个领域 Repository 统一拆成接口和实现类：接口命名为 `XxxRepository`，实现类命名为 `XxxRepositoryImpl`。

3. Service 只依赖 Repository 接口，禁止依赖 `XxxRepositoryImpl`，也不能直接调用 Mapper。

4. Repository 实现类统一放在 `repository.impl` 包，使用 `@Repository`，并实现对应的 Repository 接口。

5. Repository 接口中的所有公开方法必须写必要注释；实现类中对应的实现方法不重复写相同注释。

6. 同一业务的数据访问优先收口到一个 Repository，不为了读写、查询、执行再拆多个 Repository。

7. Repository 实现类依赖注入统一使用 `@Resource`，不手写仅用于依赖注入的构造方法。

8. DAO 提供统一的 `BaseRepository<T>` 和 `BaseRepositoryImpl<M, T>`，用于封装基础 CRUD、列表、数量和简单分页能力。

9. 领域 Repository 接口统一继承 `BaseRepository<Entity>`；领域 RepositoryImpl 统一继承 `BaseRepositoryImpl<Mapper, Entity>`。

10. BaseRepository 已提供的基础能力直接使用，不在领域 Repository 中重复声明，也不在 RepositoryImpl 中写一层无意义转发。

例如禁止：

```java
@Override
public ProjectEntity addProject(ProjectEntity entity) {
    return add(entity);
}
```

没有特殊逻辑时直接使用：

```java
projectRepository.add(entity);
```

11. 只有基础方法无法表达领域语义，或确实存在特殊查询、特殊写入、额外持久化逻辑时，才在 `XxxRepository` 中新增领域方法。

12. 领域 Repository 新增的专属方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名。

13. BaseRepository 的通用方法使用简短通用命名，例如 `add`、`deleteById`、`update`、`queryById`、`queryList`、`queryCount`、`queryPage`。

14. Service 不直接注入 `BaseRepository`，而是通过具体领域 Repository 使用继承得到的基础能力。

15. Repository 不重复做 Service / DTO 已完成的参数判空，不写没有实际意义的 `Objects.requireNonNull`。

16. Repository 隐藏 MyBatis-Plus、Mapper、XML 等持久化细节，Service 只看到 Entity、DTO、PageData 等项目自己的类型。

17. 分页查询统一使用 MyBatis-Plus 的 `Page / IPage`，禁止在 Service 中手动计算 `total`、`offset`、`pages`。

18. RepositoryImpl 负责创建 MyBatis-Plus `Page` 并调用 Mapper，Service 只接收统一的 `PageData`，不感知 MyBatis-Plus 分页实现。

19. 复杂分页查询可以继续使用 `Mapper + XML`，但 XML 中不手写 `LIMIT / OFFSET`，由 MyBatis-Plus 分页插件统一处理；总数统计也交给分页插件。

20. 简单方法声明和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行。
