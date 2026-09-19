# Java Backend Architecture

Yakable's backend follows the same boundary idea that makes Dify's backend maintainable, translated into Java modules instead of copying Python directory names literally.

## Dify to Yakable mapping

| Dify | Yakable |
| --- | --- |
| controllers | `yakable-interfaces` / `interfaces.rest` |
| services | `yakable-application` |
| core | `yakable-domain` |
| models | `yakable-dao` persistence models |
| repositories | Domain repository ports + DAO repository adapters |
| extensions | `yakable-infrastructure` |
| events | Domain/Application events when a real event boundary exists |
| tasks | Application job ports + Infrastructure async/worker adapters |
| libs | `yakable-common` |
| configs | `yakable-boot.configuration` |

The mapping is about responsibility, not directory imitation.

## Module graph

```text
yakable-boot
  ├── yakable-interfaces
  │     └── yakable-application
  │             └── yakable-domain
  │
  ├── yakable-dao
  │     ├── yakable-application
  │     └── yakable-domain
  │
  └── yakable-infrastructure
        ├── yakable-application
        └── model plugin API

yakable-plugin-model-*
  └── provider implementations discovered with AutoService / ServiceLoader

yakable-common
  └── business-agnostic shared code only
```

Dependencies point toward business policy. Domain and Application never depend on Boot, REST, MyBatis, Flyway, concrete persistence adapters, or concrete LLM providers.

## Module ownership

### yakable-domain

Owns business concepts, invariants, domain exceptions, and repository contracts.

Current examples:

```text
Project
Session
Turn
SessionMessage

ProjectRepository
SessionRepository
SessionExecutionRepository
```

Rules:

- framework independent;
- no Spring annotations;
- no HTTP types;
- no MyBatis/Flyway types;
- no plugin/provider SDK;
- repository interfaces describe business-required persistence semantics;
- state-transition rules belong on the domain model where possible.

### yakable-application

Owns use cases, orchestration, and outbound application ports.

Current examples:

```text
ProjectBootstrapService
ProjectOverviewQueryService
SessionCommandService
SessionQueryService
SessionTurnService
TurnExecutor
ContextPolicy
DefaultContextPolicy
ContextBundle
ModelInvocationCompiler

ModelGateway
TurnDispatcher
TransactionRunner
```

Rules:

- coordinates Domain objects and ports;
- owns use-case ordering and transaction boundaries;
- must not know REST, MyBatis, Flyway, or concrete persistence;
- must not instantiate DeepSeek, Kimi, OpenAI, or another provider;
- external capabilities are expressed as Application ports.

`ProjectBootstrapService` owns:

```text
transaction
  -> create Project
  -> create Session
  -> create initial Turn + USER Message
commit
  -> dispatch execution
```

`SessionTurnService` owns:

```text
transaction
  -> persist Turn + USER Message
  -> touch Session
commit
  -> dispatch execution
```

`TurnExecutor` keeps external model I/O outside database transactions. Context admission is delegated to the Context Harness:

```text
claim Turn
  -> load context candidates
  -> ContextPolicy
  -> ModelInvocationCompiler
  -> call ModelGateway

transaction
  -> complete/fail Turn
  -> persist result/touch Session
commit
```

### yakable-interfaces

Owns inbound transport adapters.

Rules:

- parse and validate HTTP input;
- call one Application use case;
- map Application/Domain results to HTTP responses;
- translate Domain/Application failures at the transport boundary;
- do not query repositories directly;
- do not call DAO/Mapper directly;
- do not dispatch background work directly;
- do not call model plugins directly.

### yakable-dao

Owns relational persistence.

Persistence corridor:

```text
Application
  -> Domain Repository Port
  -> Repository Adapter
  -> DAO
  -> MyBatis-Plus Mapper
  -> PO
  -> MySQL
```

Current package roles:

```text
dao/project
  ├── ProjectRepositoryAdapter
  ├── ProjectDao / MybatisProjectDao
  ├── mapper/ProjectMapper
  └── model/ProjectPO

dao/session
  ├── SessionRepositoryAdapter
  ├── SessionExecutionRepositoryAdapter
  ├── SessionDao / SessionExecutionDao
  ├── mapper/*
  └── model/*

dao/transaction
  └── SpringTransactionRunner

db/migration/yakable
  └── Flyway migrations
```

Rules:

- Repository Adapter owns Domain <-> PO translation;
- DAO/Mapper never accepts HTTP DTOs or returns HTTP VOs;
- MyBatis-Plus types never cross into Domain/Application;
- PO classes never leave `yakable-dao`;
- simple single-table access uses MyBatis-Plus;
- atomic/CAS SQL may use explicit Mapper SQL;
- Flyway is the only owner of schema evolution;
- `yakable_schema_history` is the dedicated migration history table.

### yakable-infrastructure

Owns non-database outbound adapters.

Current adapters:

```text
infrastructure/model
infrastructure/async
```

Examples for the future:

```text
storage
git
workspace
shell
external HTTP clients
worker/message-broker adapters
```

Database persistence does not return to this module; it has its own `yakable-dao` boundary.

### yakable-boot

Owns composition only:

```text
Spring Boot entrypoint
configuration
configuration properties
bean wiring
runtime datasource settings
```

Boot may depend on runtime modules because it is the composition root.

Business logic, REST controllers, Mapper/DAO code, and provider protocol code do not belong in Boot.

### yakable-common

Owns business-agnostic utilities and shared primitives only.

Do not create `ProjectUtils`, `SessionUtils`, `ModelUtils`, or similar business dumping grounds here.

### yakable-spi and plugins

`yakable-spi` is reserved for stable extension contracts broader than one Application use case.

LLM providers continue to use the dedicated model plugin API and AutoService registration. Application sees only `ModelGateway`; Infrastructure adapts that gateway to the plugin runtime.

## Persistence rules

### Repository vs DAO

Repository is a Domain Port:

```text
SessionRepository
SessionExecutionRepository
```

DAO is a database access role:

```text
SessionDao
SessionExecutionDao
SessionMapper
TurnMapper
MessageMapper
```

Application never depends on DAO.

### Transaction ownership

Application decides what is atomic through `TransactionRunner`.

DAO implements that boundary with Spring transactions.

This avoids putting `@Transactional` into the framework-independent Application module while still allowing a use case to own its transaction lifecycle.

### Session consistency

`SessionExecutionRepository` is not decomposed into generic CRUD operations.

Its adapter preserves the consistency boundary with:

```text
createPendingTurn
  -> lock Session row FOR UPDATE
  -> verify no PENDING/RUNNING Turn
  -> insert Turn
  -> allocate next Message sequence
  -> insert USER Message

claimPendingTurn
  -> UPDATE ... WHERE status = 'PENDING'
  -> affected rows == 1 means claim succeeded

completeTurn
  -> lock Session row FOR UPDATE
  -> RUNNING -> SUCCEEDED with CAS condition
  -> allocate next Message sequence
  -> insert ASSISTANT Message
  -> all in one transaction
```

Database constraints back the Java rules, including a unique `(session_id, message_sequence)` key.

### Flyway

Migration files live with the persistence implementation:

```text
yakable-dao/src/main/resources/db/migration/yakable
```

Current migrations:

```text
V1__create_project.sql
V2__create_session.sql
V3__create_turn.sql
V4__create_message.sql
```

Do not mutate an applied migration. Add a new versioned migration for every schema change.

## Programming rules

### Controller rule

A controller should look conceptually like:

```text
validate request
  -> create command
  -> call Application service
  -> map response
```

If a Controller starts coordinating repositories, DAO, LLM calls, async dispatch, or Domain state transitions, the logic is in the wrong layer.

### Async rule

Application requests asynchronous work through `TurnDispatcher`.

Virtual threads, queues, workers, retries, and message brokers are Infrastructure details.

When retries or distributed workers are introduced, handlers must be idempotent.

### Configuration rule

Runtime configuration is strongly typed or centralized in Boot configuration.

Do not scatter `System.getenv(...)` calls through business code.

### Events rule

Do not add empty event packages just to match an architecture diagram.

Introduce Domain or Application events when a real side effect should be decoupled from a use case, for example audit, indexing, notification, or cleanup.

## Why yakable-core was removed

The old `yakable-core` mixed Domain model, Application orchestration, and model-plugin runtime responsibilities.

The current ownership is explicit:

```text
domain          = business truth
application     = use-case orchestration
dao             = relational persistence
interfaces      = inbound transport
infrastructure  = non-database outbound technology
boot            = composition
```

This is the baseline for database-backed Sessions, SSE, Agent execution, and Frontend Taste Harness capabilities.


## Read model boundary

Command-side repositories remain business persistence ports:

```text
ProjectRepository
SessionRepository
SessionExecutionRepository
```

UI-oriented reads use Application query ports instead of assembling views through
Domain repositories:

```text
ProjectOverviewQueryService
  -> ProjectQueryRepository
  -> ProjectQueryRepositoryAdapter
  -> ProjectQueryDao
  -> ProjectQueryMapper
  -> paged SQL projection

SessionQueryService
  -> SessionQueryRepository
  -> SessionQueryRepositoryAdapter
  -> SessionQueryDao
  -> dedicated read mappers
```

Rules:

- do not add list-screen joins or pagination concerns to Domain Repository ports;
- query adapters may return Application read models;
- SQL owns ordering, latest-row selection, limits, and cursors;
- Project list queries must not perform per-Project Session lookups;
- active Session polling uses Message sequence cursors rather than reloading the
  full conversation;
- historical Message pagination uses `beforeSequence` so inserts at the tail do
  not shift older pages.

Current HTTP read contracts:

```text
GET /api/projects?current=1&pageSize=50
GET /api/projects/{projectId}
GET /api/projects/{projectId}/sessions/{sessionId}
GET /api/projects/{projectId}/sessions/{sessionId}/changes?afterSequence=N
GET /api/projects/{projectId}/sessions/{sessionId}/messages?beforeSequence=N&limit=50
```

The full Session snapshot remains the initial-load contract for now. Polling uses
the incremental changes endpoint. A later UI change can move initial history
loading to the Message page endpoint without changing the command model.
