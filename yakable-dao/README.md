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

## 规范文档

- [CODE_README.md](./CODE_README.md)：DAO 通用代码规范、Mapper、XML、Flyway、代码格式。
- [ENTITY_README.md](./ENTITY_README.md)：Entity、BaseEntity、时间、ID、枚举持久化规范。
- [REPOSITORY_README.md](./REPOSITORY_README.md)：Repository 职责、依赖注入、方法命名、分页规范。

## 核心原则

**Entity 对应表，Mapper 对应表，Repository 对应数据访问能力。**

**公共能力只实现一次，持久化细节留在 DAO 内部。**
