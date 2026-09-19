# Java Backend Architecture

Yakable's backend follows the same boundary idea that makes Dify's backend
maintainable, translated into Java modules instead of copying Python directory
names literally.

## Dify to Yakable mapping

| Dify | Yakable |
| --- | --- |
| controllers | `yakable-interfaces` / `interfaces.rest` |
| services | `yakable-application` |
| core | `yakable-domain` |
| models | infrastructure persistence entities, when database persistence exists |
| repositories | domain repository ports + infrastructure adapters |
| extensions | `yakable-infrastructure` |
| events | domain/application events, only when a real event boundary exists |
| tasks | application job handlers + infrastructure async/worker adapters |
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
  └── yakable-infrastructure
        ├── yakable-application
        ├── yakable-domain
        └── model plugin API

yakable-plugin-model-*
  └── provider implementations discovered with AutoService / ServiceLoader

yakable-common
  └── business-agnostic shared code only
```

Dependencies point toward business policy. Domain and Application never depend
on Boot, REST, Spring configuration, persistence implementations, or concrete
LLM providers.

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
- no plugin/provider SDK;
- repository interfaces belong here when persistence is part of the domain
  boundary;
- state-transition rules belong on the domain model where possible.

### yakable-application

Owns use cases and orchestration.

Current examples:

```text
ProjectBootstrapService
ProjectOverviewQueryService
SessionCommandService
SessionQueryService
SessionTurnService
TurnExecutor
TurnPromptAssembler

ModelGateway
TurnDispatcher
```

Rules:

- coordinates domain objects and ports;
- owns use-case ordering and transaction boundaries;
- must not know REST or concrete persistence;
- must not instantiate DeepSeek, Kimi, OpenAI, or another provider;
- external capabilities are expressed as application ports.

`ProjectBootstrapService`, not the REST controller, owns:

```text
create Project
  -> create Session
  -> create initial Turn
  -> dispatch execution
```

`SessionTurnService`, not the REST controller, owns:

```text
persist new Turn
  -> dispatch execution
```

### yakable-interfaces

Owns inbound transport adapters.

Current adapter:

```text
interfaces/rest
```

Rules:

- parse and validate HTTP input;
- call one application use case;
- map application/domain results to HTTP responses;
- translate domain/application failures at the transport boundary;
- do not query repositories directly;
- do not dispatch background work directly;
- do not call model plugins directly.

### yakable-infrastructure

Owns implementations that touch the outside world.

Current adapters:

```text
infrastructure/persistence/memory
infrastructure/model
infrastructure/async
```

Rules:

- implements ports owned by Domain or Application;
- provider discovery and plugin API mapping live here;
- persistence implementation details live here;
- asynchronous executor details live here;
- business decisions do not originate here.

When database persistence is introduced, ORM entities belong under a path such
as:

```text
io.yakable.infrastructure.persistence.jpa.entity
```

Domain models remain persistence-framework independent.

### yakable-boot

Owns composition only:

```text
Spring Boot entrypoint
configuration
configuration properties
bean wiring
```

Boot may depend on all runtime modules because it is the composition root.

Business logic, REST controllers, repositories, and provider protocol code do
not belong in Boot.

### yakable-common

Owns business-agnostic utilities and shared primitives only.

Do not create `ProjectUtils`, `SessionUtils`, `ModelUtils`, or similar
business dumping grounds here.

### yakable-spi and plugins

`yakable-spi` is reserved for stable extension contracts that are broader
than one application use case.

LLM providers continue to use the dedicated model plugin API and AutoService
registration. The Application layer sees only `ModelGateway`; the
Infrastructure layer adapts that gateway to the plugin runtime.

## Programming rules

### Controller rule

A controller should look conceptually like:

```text
validate request
  -> create command
  -> call application service
  -> map response
```

If a controller starts coordinating repositories, LLM calls, async dispatch,
or domain state transitions, the logic is in the wrong layer.

### Transaction rule

Write transactions must be explicit and bounded.

Do not keep a database transaction open while waiting for an LLM or another
slow external service unless atomicity genuinely requires it.

For a future persistent Turn flow, prefer:

```text
transaction
  -> persist pending Turn and USER Message
commit

external model call

transaction
  -> persist ASSISTANT Message and complete Turn
commit
```

The repository contract must preserve the Session consistency invariants.

### Repository rule

A repository interface describes business-required persistence semantics.

An adapter describes how those semantics are implemented.

For example:

```text
domain
  SessionExecutionRepository

infrastructure
  InMemorySessionExecutionRepository
  JpaSessionExecutionRepository   # future
```

### Async rule

Application code requests asynchronous work through a port such as
`TurnDispatcher`.

Thread pools, virtual threads, queues, Celery-like workers, retries, and message
brokers are infrastructure details.

When retries or distributed workers are introduced, handlers must be
idempotent.

### Configuration rule

Runtime configuration is strongly typed under
`yakable-boot.configuration.properties`.

Do not scatter `System.getenv(...)` calls through business code.

### Events rule

Do not add empty event packages just to match an architecture diagram.

Introduce domain or application events when there is a real side effect that
should be decoupled from a use case, for example audit, indexing, notification,
or cleanup.

## Why yakable-core was removed

The old `yakable-core` mixed two different responsibilities:

```text
domain model
+
application orchestration
+
model plugin runtime
```

That made the dependency boundary ambiguous.

The replacement makes ownership explicit:

```text
domain          = business truth
application     = use-case orchestration
interfaces      = inbound transport
infrastructure  = outbound technology
boot            = composition
```

This is the baseline for later database persistence, SSE, Agent execution, and
Frontend Taste Harness capabilities.
