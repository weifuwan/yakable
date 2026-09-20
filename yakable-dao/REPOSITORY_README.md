# Repository 开发规范

## 职责边界

1. Repository 是 `yakable-dao` 唯一对外的数据访问入口。每个 Service 只能直接依赖自己这张表对应的 Repository 接口，禁止依赖其他表的 Repository、`XxxRepositoryImpl`、`BaseRepository` 或直接调用 Mapper；Repository 负责隐藏 MyBatis-Plus、Mapper、XML 等持久化细节。

2. 一张业务表对应一个 Repository。Repository 只负责自己这张表的数据访问，禁止一个 Repository 注入其他表的 Mapper 或代替其他 Repository 处理跨表持久化逻辑。跨表业务编排统一交给 Service，并通过对应表的 Service 调用。

## 目录与继承

3. 每张业务表的 Repository 统一拆成接口和实现类：接口命名为 `XxxRepository`，实现类命名为 `XxxRepositoryImpl`。接口放在 `repository` 包，实现类放在 `repository.impl` 包并使用 `@Repository`。

4. DAO 统一提供 `BaseRepository<T>` 和 `BaseRepositoryImpl<M, T>`。每张表的 Repository 接口继承 `BaseRepository<Entity>`，RepositoryImpl 继承 `BaseRepositoryImpl<Mapper, Entity>` 并实现对应接口；RepositoryImpl 只注入本表对应的 Mapper。

## 方法设计

5. `BaseRepository` 统一提供基础能力，例如 `add`、`deleteById`、`update`、`queryById`、`queryList`、`queryCount`、`queryPage`。基础方法已经能够满足需求时直接使用，领域 Repository 不重复声明，RepositoryImpl 也不写无意义转发。

禁止：

```java
@Override
public ProjectEntity addProject(ProjectEntity entity) {
    return add(entity);
}
```

直接使用：

```java
projectRepository.add(entity);
```

6. 只有基础方法无法表达本表数据访问语义，或确实存在本表特殊查询、特殊写入时，才在 `XxxRepository` 中新增专属方法。专属方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名；涉及其他表时不得继续往当前 Repository 堆方法。

7. Repository 接口中的公开方法必须写必要注释；RepositoryImpl 中对应的实现方法不重复写相同注释。

8. RepositoryImpl 依赖注入统一使用 `@Resource`，不手写仅用于依赖注入的构造方法；不重复做 Service / DTO 已完成的参数判空，不写没有实际意义的 `Objects.requireNonNull`。

## 分页

9. 分页统一使用 MyBatis-Plus `Page / IPage`。RepositoryImpl 负责创建分页对象并调用本表 Mapper，Service 只接收统一的 `PageData`，禁止手动计算 `total`、`offset`、`pages`。复杂分页可以使用本表 `Mapper + XML`，但不得借此访问其他表；跨表数据由上层 Service 调用对应 Service 后组装。XML 不手写 `LIMIT / OFFSET`，总数统计交给分页插件。

## 代码格式

10. 简单方法声明和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行，换行后保持结构紧凑、统一。
