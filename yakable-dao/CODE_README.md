# yakable-dao 通用代码规范

1. 一张业务表固定对应一个 Entity、一个 Mapper、一个 Repository 和一个 Service。Mapper 统一放在 `mapper` 包并继承 MyBatis-Plus `BaseMapper<Entity>`；Repository 只访问本表 Mapper，Service 只直接依赖本表 Repository。跨表业务逻辑必须通过对应 Service 调用，禁止跨表直接调用 Repository 或 Mapper。

2. Lambda 能解决的，不写 XML；Lambda 开始复杂、难读、难维护时，使用 `Mapper + XML`。

3. 禁止在 Mapper 中使用大段 `@Select`、`@Update` 等注解 SQL，复杂 SQL 统一放 XML。

4. MyBatis-Plus 已经提供的 CRUD、条件构造器、字段自增自减、分页、自动填充等能力优先直接使用，禁止为了统一形式重复封装同类工具或手写 SQL 重新实现。

5. 公共能力遵循“先框架、再现有基础类、再局部提取、最后公共抽象”的顺序。单个类内部重复优先使用 `private` 方法解决，只有多个类出现稳定重复后才允许增加公共支撑类。

6. 数据库结构变更统一使用 Flyway 管理。

7. 新增持久化代码时优先保持现有结构，不新增没有必要的中间层和重复角色。

8. 简单方法声明和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行。

9. 换行后保持结构紧凑、统一，禁止为了一个参数做无意义换行，禁止把 `) {` 单独悬空。
