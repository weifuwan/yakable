# yakable-dao

`yakable-dao` only owns database persistence.

Call chain:

```text
Service
  ↓
Repository
  ↓
Mapper
  ↓
Entity
```

## Rules

Load only the rule file required by the task:

- [ENTITY_RULES.md](./ENTITY_RULES.md) — Entity mapping, BaseEntity, ID, time, enum and comments.
- [REPOSITORY_RULES.md](./REPOSITORY_RULES.md) — Repository, Mapper, SQL, state update and pagination.
- [FLYWAY_RULES.md](./FLYWAY_RULES.md) — Schema and Migration contract.

Cross-table business orchestration does not belong in DAO.
