# yakable-dao

yakable-dao is the persistence implementation module. Its job is to persist
Domain/Application data, not to introduce another application architecture.

## Persistence rules

### One table, one Mapper

Each physical table owns one MyBatis-Plus BaseMapper<PO>.

Examples:

- ProjectMapper -> yak_project
- SessionMapper -> yak_session
- TurnMapper -> yak_turn
- MessageMapper -> yak_message

Do not create separate read/write/query mappers for the same table unless the
database itself requires a genuinely different persistence boundary.

### Single-table SQL stays in a concrete DAO

Simple CRUD, filters, ordering, pagination cursors, conditional updates and
state transitions use MyBatis-Plus lambda wrappers in a concrete DAO.

~~~text
ProjectDao  -> ProjectMapper
SessionDao  -> SessionMapper
TurnDao     -> TurnMapper
MessageDao  -> MessageMapper
~~~

The DAO is a small table-oriented persistence helper. It is intentionally a
concrete class. Do not add a FooDao interface plus MybatisFooDao implementation
when there is only one persistence implementation.

### Multi-table queries use Mapper XML

When a query joins tables or builds a dedicated read projection, declare the
method on the relevant Mapper and put the SQL in src/main/resources/mapper/**.

Example:

~~~text
ProjectQueryRepositoryAdapter
        |
        v
ProjectMapper
        |
        v
mapper/project/ProjectMapper.xml
~~~

Keep large SQL out of Java annotations.

### RepositoryAdapter is the architecture boundary

Repository adapters implement Domain/Application repository interfaces. They
may coordinate several table DAOs, map PO objects to Domain/Application models,
and define transaction boundaries.

~~~text
Domain/Application Repository
            |
            v
RepositoryAdapter
      |           |
      v           v
single-table DAO  multi-table Mapper/XML
      |
      v
BaseMapper<PO>
~~~

Do not insert another QueryDao -> MybatisQueryDao -> QueryMapper chain between
a RepositoryAdapter and the database.

## Decision table

| Need | Use |
| --- | --- |
| Insert/update/select by id | table DAO + BaseMapper |
| Single-table filter/order/cursor | table DAO + LambdaQueryWrapper |
| Single-table conditional state update | table DAO + LambdaUpdateWrapper |
| Row lock / small DB-specific suffix | table DAO + wrapper last(...) when safe |
| Multi-table join/read projection | Mapper method + XML |
| Domain/Application conversion | RepositoryAdapter |
| Schema migration | Flyway |

## Things we intentionally avoid

- one interface for every DAO class;
- MybatisXxxDao classes that only forward calls to a Mapper;
- separate XxxQueryDao and XxxQueryMapper for ordinary single-table reads;
- large Select/Update annotation SQL blocks in Java;
- persistence types leaking into Application, Domain or HTTP layers.
