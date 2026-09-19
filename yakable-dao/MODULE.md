# yakable-dao

## Purpose

Own relational persistence: repository adapters, DAO/Mapper code, persistence objects, transactions, and Flyway schema evolution.

## Owns

- Domain/Application repository adapter implementations
- MyBatis-Plus and explicit SQL
- PO <-> Domain/Application mapping
- database transaction implementation
- Flyway migrations

## Does not own

- business invariants
- HTTP contracts
- model-provider calls
- application workflow decisions
- cross-domain orchestration

## Key entry points

```text
src/main/java/io/yakable/dao/project/
src/main/java/io/yakable/dao/session/
src/main/java/io/yakable/dao/transaction/
src/main/resources/db/migration/yakable/
```

Typical persistence corridor:

```text
Repository Port
  -> Repository Adapter
  -> DAO
  -> Mapper
  -> PO
  -> Database
```

## Dependency boundary

May depend on Domain and Application contracts plus persistence technology. MyBatis/Flyway/PO types must not leak back into Domain or Application.

## Add to context when

Load this module only when a task touches SQL, persistence behavior, atomicity, schema, mapping, paging, or database-backed read models.

For pure domain or workflow review, keep DAO out until persistence details matter.
