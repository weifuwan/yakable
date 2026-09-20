# Flyway 建表规范

## 基本原则

1. 所有数据库结构变更统一使用 Flyway 管理。已经进入共享环境、测试环境或生产环境并执行过的 Migration 禁止修改，只能新增新的 Migration 文件；仅在项目开发初期、确认所有数据库都可以整体重建时，允许合并历史版本并重新生成单一 baseline。baseline 一旦进入共享环境后同样禁止修改。

2. Migration 文件统一使用 `V{版本号}__{英文描述}.sql`，描述使用小写下划线，例如 `V10__normalize_project_table.sql`。

3. 建表语句必须明确表名、字段类型、字段注释、索引、存储引擎、字符集和排序规则，不依赖数据库默认值。

## 表名与主键

4. 业务表统一使用 `yak_` 前缀，表名和字段名统一使用小写下划线。

5. 所有业务表主键统一命名为 `id`，类型统一为：

```sql
id VARCHAR(64) NOT NULL COMMENT '主键ID'
```

6. 主键统一由应用生成，不使用数据库自增主键。

7. 禁止创建数据库外键。表之间只保留关联 ID 字段，例如 `project_id`、`session_id`、`turn_id`；关联关系和级联业务由 Service 层控制。

## 字段设计

8. 每一个字段都必须有中文 `COMMENT`，禁止出现没有字段说明的建表或加字段 SQL。

9. 表本身也必须有中文 `COMMENT`，说明该表承载的业务含义。

10. 字符串字段禁止无脑使用 `VARCHAR(255)`。长度必须根据业务实际值估算后确定；能够明确上限时使用合理的 `VARCHAR(n)`，确实属于长文本时使用 `TEXT`、`MEDIUMTEXT` 等类型。

11. 常用长度按照实际语义选择：ID 类字段统一 `VARCHAR(64)`；短编码、类型名、提供商等通常使用 `VARCHAR(32)` 或 `VARCHAR(64)`；名称、标题等根据业务最大长度选择 `VARCHAR(64)`、`VARCHAR(128)` 等。禁止为了省事统一使用 255。

12. 所有 `VARCHAR`、`CHAR`、`TEXT` 等字符字段必须显式声明字符集和排序规则，默认使用：

```sql
CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
```

13. 数字、时间、布尔、枚举等非字符字段不声明字符集。

14. 字段是否允许 `NULL` 必须根据业务语义确定；必填字段使用 `NOT NULL`，可选字段才允许 `NULL`。禁止为了避免判空给业务字段设置没有实际意义的默认值。

15. 时间字段统一使用当前项目约定的高精度时间类型 `TIMESTAMP(6)`，公共字段统一使用 `create_time`、`update_time`。

16. 审计字段统一使用 `create_by`、`update_by`，类型统一为 `VARCHAR(64)`，并显式声明字符集、排序规则和中文注释。

## 枚举字段

17. 枚举字段统一保存数字值，不保存 Java 枚举名称字符串。

18. 枚举字段优先根据取值范围使用 `TINYINT`、`SMALLINT`、`INT` 等整数类型。

19. 枚举字段的中文注释必须完整写出每个值代表的含义，例如：

```sql
status TINYINT NOT NULL COMMENT '状态：0-待执行，1-执行中，2-成功，3-失败'
```

禁止只写 `COMMENT '状态'`。

## 索引

20. 实际用于查询条件的字段必须评估并建立索引，重点关注 `WHERE`、`ORDER BY`、唯一性约束以及表之间的关联 ID。

21. 关联字段虽然不建立外键，但只要存在按关联 ID 查询的场景，就必须建立索引，例如 `project_id`、`session_id`、`turn_id`。

22. 多字段查询优先根据真实查询条件设计联合索引。等值查询字段放前面，排序、范围查询字段放后面，并遵循最左匹配原则。

23. 如果联合索引已经覆盖单字段查询，不重复创建没有必要的前缀索引。

24. 业务唯一性通过唯一索引保证，命名统一使用 `uk_<表名去前缀>_<字段>`；普通索引统一使用 `idx_<表名去前缀>_<字段>`。

25. 低区分度枚举字段通常不单独建索引；如果存在明确查询场景，应与时间、关联 ID 等字段组成联合索引。

## 表配置

26. 所有业务表必须显式指定存储引擎：

```sql
ENGINE=InnoDB
```

27. 所有业务表必须显式指定默认字符集和排序规则：

```sql
DEFAULT CHARACTER SET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci
```

28. 建表语句统一以完整表配置结束：

```sql
ENGINE=InnoDB
DEFAULT CHARACTER SET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci
COMMENT='业务表中文说明';
```

## 建表示例

```sql
CREATE TABLE yak_example (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID',
    project_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'Project ID',
    name VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '名称',
    status TINYINT NOT NULL COMMENT '状态：0-待处理，1-处理中，2-完成，3-失败',
    create_time TIMESTAMP(6) NOT NULL COMMENT '创建时间',
    update_time TIMESTAMP(6) NOT NULL COMMENT '更新时间',
    create_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '创建人ID',
    update_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新人ID',
    PRIMARY KEY (id),
    KEY idx_example_project_id (project_id),
    KEY idx_example_project_update_time (project_id, update_time)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='示例业务表';
```

## SQL 约束

29. Flyway Migration 不使用 `IF NOT EXISTS`、`IF EXISTS` 掩盖数据库结构异常。预期结构不一致时应让 Migration 失败并定位问题。

30. 一个 Migration 只处理一个明确的数据库变更主题，禁止把互不相关的建表、改字段、数据修复混在同一个文件中。

31. 删除表、删除字段、修改字段类型等破坏性变更必须单独评估数据兼容和回滚风险，不能直接覆盖旧 Migration。
