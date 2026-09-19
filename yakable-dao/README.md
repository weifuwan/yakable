# yakable-dao

yakable-dao is Yakable's persistence implementation module.

The module keeps one persistence path only:

~~~text
Domain/Application Repository interface
                |
                v
        RepositoryImpl
                |
                v
              Mapper
                |
                v
              Entity
~~~

## Package structure

~~~text
io.yakable.dao
├── config
├── entity
│   ├── ProjectEntity
│   ├── SessionEntity
│   ├── TurnEntity
│   └── MessageEntity
├── mapper
│   ├── ProjectMapper
│   ├── SessionMapper
│   ├── TurnMapper
│   └── MessageMapper
├── repository
│   └── impl
│       ├── ProjectRepositoryImpl
│       ├── ProjectQueryRepositoryImpl
│       ├── SessionRepositoryImpl
│       ├── SessionExecutionRepositoryImpl
│       └── SessionQueryRepositoryImpl
├── transaction
└── config
~~~

## Entity

Database persistence objects use the Entity suffix and live only in
io.yakable.dao.entity.

Entity classes may contain MyBatis-Plus mapping annotations. Persistence
entities must not leak into Domain, Application or HTTP code.

Do not introduce PO/DO naming alongside Entity.

## Mapper

One physical table owns one Mapper:

- ProjectMapper -> yak_project
- SessionMapper -> yak_session
- TurnMapper -> yak_turn
- MessageMapper -> yak_message

Each Mapper extends BaseMapper<Entity>.

Simple single-table CRUD, filters, ordering, cursors and conditional updates
use MyBatis-Plus lambda wrappers from RepositoryImpl.

Complex SQL, joins, aggregates and dedicated read queries are declared on the
relevant Mapper and implemented in XML.

Large Select/Update annotations are not used.

## Repository

Repository is the only persistence entry point used outside yakable-dao.

Repository contracts remain owned by Domain/Application. yakable-dao provides
their implementation under io.yakable.dao.repository.impl.

RepositoryImpl is responsible for:

- translating Domain/Application objects to and from Entity;
- transaction boundaries;
- coordinating multiple table Mappers when one persistence operation spans
  several tables;
- using lambda wrappers for single-table operations;
- calling Mapper XML methods for complex queries.

There is no second Dao layer between RepositoryImpl and Mapper.

## Rules

Use this decision table when adding persistence code:

| Need | Location |
| --- | --- |
| Table mapping | entity |
| Basic table access | mapper BaseMapper |
| Single-table condition/query/update | repository/impl + lambda wrapper |
| Multi-table query / aggregate / complex SQL | mapper method + XML |
| Domain/Application conversion | repository/impl |
| Transaction boundary | repository/impl |
| Schema migration | Flyway |

Do not add:

- XxxDao / XxxDaoImpl;
- XxxRepositoryAdapter;
- XxxQueryMapper for the same physical table;
- MybatisXxxRepository naming;
- PO/DO classes alongside Entity;
- persistence types to Domain/Application/HTTP APIs.

When a new table is added, the default is one Entity + one Mapper. Add or
extend a RepositoryImpl only when upper layers need that persistence behavior.
