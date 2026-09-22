# Flyway Rules

Scope:
- `yakable-dao/src/main/resources/db/migration/yakable/**`

Depends On:
- `./ENTITY_RULES.md`
- `./REPOSITORY_RULES.md`
- Schema 行为变化时加载 `/BACKEND_TEST_RULES.md`

Owns:
- 数据库 Schema 历史
- 表 / 字段约束
- 索引定义
- Migration 顺序

## Migration Contract

- 所有数据库结构变更统一由 Flyway 管理。
- 已进入共享、测试或生产环境的 Migration 禁止修改，只能新增 Migration。
- 仅在开发初期且所有数据库都可整体重建时允许合并历史；新 baseline 进入共享环境后同样不可修改。
- 文件命名使用 `V{version}__{lower_snake_description}.sql`。
- 一个 Migration 只处理一个明确变更主题。
- 禁止用 `IF EXISTS / IF NOT EXISTS` 掩盖异常 Schema。
- 删除表 / 字段、修改字段类型等破坏性变更必须单独评估兼容与回滚风险。

## Table Contract

Must:
- 业务表使用 `yak_` 前缀。
- 表名、字段名使用 lower_snake_case。
- 主键统一 `id`，由应用生成。
- 使用 InnoDB。
- 字符集 / 排序规则统一 `utf8mb4 / utf8mb4_0900_ai_ci`。
- 每张表和每个字段都有中文 COMMENT。
- 时间使用 `TIMESTAMP(6)`。
- 审计字段统一 `create_time / update_time / create_by / update_by`。

主键：

```sql
id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键ID'
```

表配置：

```sql
ENGINE=InnoDB
DEFAULT CHARACTER SET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci
COMMENT='业务表中文说明';
```

## Column Contract

- `VARCHAR(n)` 必须来自真实业务上限，禁止无脑 255。
- ID 通常使用 64；短编码 / Provider 通常使用 32 或 64；名称 / 标题按业务上限选择 64 / 128 等。
- 字符字段显式声明 charset / collation。
- 数字、时间、布尔、枚举字段不声明字符集。
- 必填字段使用 `NOT NULL`，只有真实可选字段允许 `NULL`。
- 禁止为了避免判空设置无意义默认值。
- 枚举保存数字值，并按范围选择合适整数类型。
- 枚举字段 COMMENT 必须完整说明每个数字含义。

## Relationship / Index Contract

- 禁止数据库外键。
- 表间只保留 `project_id / session_id / turn_id` 等关联 ID，关系业务由 Service 控制。
- 真实用于 `WHERE / ORDER BY` 和关联 ID 查询的字段必须评估索引。
- 联合索引按真实查询设计：等值字段在前，范围 / 排序字段在后。
- 联合索引已覆盖的前缀单字段索引不重复建立。
- 唯一索引命名 `uk_<table_without_prefix>_<field>`。
- 普通索引命名 `idx_<table_without_prefix>_<field>`。
- 低区分度枚举没有真实查询理由时不单独建索引。

## Tests

Schema、约束、Flyway 和 MySQL 特有行为使用 Testcontainers + MySQL Integration Test。

## Boundary

Flyway 定义数据库结构；Entity 镜像结构；Repository 消费结构；Service 拥有业务语义。
