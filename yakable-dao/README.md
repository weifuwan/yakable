# yakable-dao

`yakable-dao` 只负责数据库持久化。

固定调用链：

```text
Service
    ↓
Repository
    ↓
Mapper
    ↓
Entity
```

## 规范

- [ENTITY_README.md](./ENTITY_README.md)：Entity、BaseEntity、ID、时间、枚举和注释。
- [REPOSITORY_README.md](./REPOSITORY_README.md)：Repository、Mapper、SQL、Update 和分页。
- [FLYWAY_README.md](./FLYWAY_README.md)：数据库结构与 Migration。
