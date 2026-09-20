# Repository 开发规范

1. Repository 是 `yakable-dao` 唯一对外的数据访问入口，统一放在 `repository` 包。

2. Repository 直接调用 Mapper，不增加 Repository 接口、`Impl`、`Dao`、`Adapter` 等中间层。

3. Service 只能调用 Repository，不能直接调用 Mapper。

4. 同一业务的数据访问优先收口到一个 Repository，不为了读写、查询、执行再拆多个 Repository。

5. Repository 类和核心数据访问方法必须有必要注释，说明当前 Repository 负责的数据访问范围。

6. Repository 依赖注入统一使用 `@Resource`，不手写仅用于依赖注入的构造方法。

7. Repository 增删改查方法统一使用 `add + 领域名`、`delete + 领域名`、`update + 领域名`、`query + 领域名` 命名，例如 `addProject`、`deleteProject`、`updateProject`、`queryProject`。

8. Repository 不使用含义模糊的 `save`、`find`、`get` 作为核心方法名；新增和修改明确区分，新增直接 insert，修改直接 update。

9. Repository 不重复做 Service / DTO 已完成的参数判空，不写没有实际意义的 `Objects.requireNonNull`。

10. Repository 隐藏 MyBatis-Plus、Mapper、XML 等持久化细节，Service 只看到 Entity、DTO、PageData 等项目自己的类型。

11. 分页查询统一使用 MyBatis-Plus 的 `Page / IPage`，禁止在 Service 中手动计算 `total`、`offset`、`pages`。

12. Repository 负责创建 MyBatis-Plus `Page` 并调用 Mapper，Service 只接收统一的 `PageData`，不感知 MyBatis-Plus 分页实现。

13. 复杂分页查询可以继续使用 `Mapper + XML`，但 XML 中不手写 `LIMIT / OFFSET`，由 MyBatis-Plus 分页插件统一处理；总数统计也交给分页插件。

14. 简单方法声明和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行。
