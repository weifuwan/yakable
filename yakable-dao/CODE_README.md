# yakable-dao 通用代码规范

1. 一张物理表只对应一个 Mapper，Mapper 统一放在 `mapper` 包，并继承 MyBatis-Plus `BaseMapper<Entity>`。

2. Lambda 能解决的，不写 XML；Lambda 开始复杂、难读、难维护时，使用 `Mapper + XML`。

3. 禁止在 Mapper 中使用大段 `@Select`、`@Update` 等注解 SQL，复杂 SQL 统一放 XML。

4. 数据库结构变更统一使用 Flyway 管理。

5. 新增持久化代码时优先保持现有结构，不新增没有必要的中间层和重复角色。

6. 简单方法声明和方法调用能一行写完就一行写完；只有参数较多或单行明显过长时才允许换行。

7. 换行后保持结构紧凑、统一，禁止为了一个参数做无意义换行，禁止把 `) {` 单独悬空。
