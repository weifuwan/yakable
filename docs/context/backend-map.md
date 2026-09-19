# Yakable Backend Map

> Fast backend navigation for humans and AI. Use this file to locate the smallest useful context before reading implementation details.

This map follows the current Java architecture:

```text
interfaces -> application -> domain
                  ^
                  |
          dao / infrastructure

boot = composition root
plugins = provider implementations
```

For architecture rules, read `docs/architecture/java-backend-modules.md`.

## Module context anchors

Every Maven module in the backend reactor has a short `MODULE.md`.

After this map identifies the relevant module, read that module's `MODULE.md` before scanning implementation files. It defines what the module owns, what it must not own, its dependency boundary, and when it belongs in task context.

Model-provider submodules have their own anchors, so a provider-specific task should load only the relevant plugin module rather than the whole plugin tree.

## Project domain

### Business model

```text
yakable-domain/src/main/java/io/yakable/domain/project/
├── Project.java
├── ProjectStatus.java
└── repository/
    └── ProjectRepository.java
```

### Use cases and read models

```text
yakable-application/src/main/java/io/yakable/application/project/
├── ProjectBootstrapService.java
├── ProjectOverviewQueryService.java
├── ProjectQueryRepository.java
├── StartProjectCommand.java
├── ProjectStartResult.java
├── ProjectDetails.java
└── ProjectSummary.java
```

Start with `ProjectBootstrapService` when changing project creation.

Start with `ProjectOverviewQueryService` when changing project list/detail reads.

### Persistence

```text
yakable-dao/src/main/java/io/yakable/dao/project/
├── ProjectRepositoryAdapter.java
├── ProjectDao.java
├── MybatisProjectDao.java
├── ProjectQueryRepositoryAdapter.java
├── ProjectQueryDao.java
├── MybatisProjectQueryDao.java
├── mapper/
└── model/
```

### REST

```text
yakable-interfaces/src/main/java/io/yakable/interfaces/rest/project/
└── ProjectController.java
```

## Session / Turn / Message domain

The conceptual model is:

```text
Project
  └── Session
       └── Turn
            └── Message
```

Read `docs/architecture/session-domain.md` before changing lifecycle or consistency semantics.

### Business model

```text
yakable-domain/src/main/java/io/yakable/domain/session/
├── Session.java
├── SessionStatus.java
├── SessionMessage.java
├── Turn.java
├── TurnStatus.java
├── TurnStartResult.java
├── SessionBusyException.java
├── SessionInactiveException.java
├── SessionNotFoundException.java
├── TurnNotFoundException.java
└── repository/
    ├── SessionRepository.java
    └── SessionExecutionRepository.java
```

Important boundary:

- `SessionRepository` owns Session persistence semantics.
- `SessionExecutionRepository` owns durable Turn/Message execution semantics.

### Commands and execution

```text
yakable-application/src/main/java/io/yakable/application/session/
├── SessionCommandService.java
├── SessionTurnService.java
├── TurnExecutor.java
├── TurnExecutionRecoveryService.java
├── SessionQueryService.java
├── SessionQueryRepository.java
├── SessionSnapshot.java
├── SessionChanges.java
└── SessionMessagePage.java
```

Use these entry points:

| Task | Start with |
| --- | --- |
| Create/update Session state | `SessionCommandService` |
| Start a new user Turn | `SessionTurnService` |
| Execute a pending Turn | `TurnExecutor` |
| Recover stale execution | `TurnExecutionRecoveryService` |
| Read Session UI state | `SessionQueryService` |

Model context is owned by `io.yakable.application.context`; read `docs/architecture/context-harness.md` before changing admission or compilation rules.

### Persistence

```text
yakable-dao/src/main/java/io/yakable/dao/session/
├── SessionRepositoryAdapter.java
├── SessionExecutionRepositoryAdapter.java
├── SessionQueryRepositoryAdapter.java
├── SessionDao.java
├── SessionExecutionDao.java
├── SessionQueryDao.java
├── MybatisSessionDao.java
├── MybatisSessionExecutionDao.java
├── MybatisSessionQueryDao.java
├── mapper/
│   ├── SessionMapper.java
│   ├── TurnMapper.java
│   ├── MessageMapper.java
│   ├── SessionQueryMapper.java
│   ├── TurnQueryMapper.java
│   └── MessageQueryMapper.java
└── model/
    ├── SessionPO.java
    ├── TurnPO.java
    └── MessagePO.java
```

### REST

```text
yakable-interfaces/src/main/java/io/yakable/interfaces/rest/session/
└── SessionController.java
```

### Async execution

Application port:

```text
yakable-application/src/main/java/io/yakable/application/async/
└── TurnDispatcher.java
```

Infrastructure implementations:

```text
yakable-infrastructure/src/main/java/io/yakable/infrastructure/async/
├── VirtualThreadTurnDispatcher.java
└── TurnRecoveryWorker.java
```

## Model boundary

The current call chain is:

```text
TurnExecutor
  -> ContextPolicy
  -> ContextBundle
  -> ModelInvocationCompiler
  -> ModelGateway
  -> PluginModelGateway
  -> ModelPlugin
  -> provider implementation
```

### Application model contract

```text
yakable-application/src/main/java/io/yakable/application/model/
├── ModelGateway.java
├── ModelRequest.java
├── ModelMessage.java
└── ModelReply.java
```

Application code must depend on `ModelGateway`, not on DeepSeek/OpenAI-specific classes.

### Infrastructure adapter

```text
yakable-infrastructure/src/main/java/io/yakable/infrastructure/model/
├── PluginModelGateway.java
├── ModelPluginRegistry.java
└── ModelPluginConfigurationResolver.java
```

### Provider plugin API

```text
yakable-plugins/yakable-plugin-model/yakable-plugin-model-api/
└── src/main/java/io/yakable/plugin/model/api/
    ├── ModelPlugin.java
    ├── ModelPluginDescriptor.java
    ├── ModelPluginConfiguration.java
    ├── ModelCapability.java
    ├── LlmRequest.java
    ├── LlmMessage.java
    ├── LlmResponse.java
    └── LlmUsage.java
```

### Concrete providers

```text
yakable-plugins/yakable-plugin-model/
├── yakable-plugin-model-deepseek/
└── yakable-plugin-model-openai-compatible/
```

When debugging provider-independent behavior, stop at `ModelGateway` / `PluginModelGateway`.

Only enter concrete plugins when the issue is provider protocol, configuration, payload mapping, or provider-specific behavior.

## Database and transactions

### Transaction abstraction

Application port:

```text
yakable-application/src/main/java/io/yakable/application/transaction/
└── TransactionRunner.java
```

DAO implementation:

```text
yakable-dao/src/main/java/io/yakable/dao/transaction/
└── SpringTransactionRunner.java
```

Application owns what must be atomic; DAO/Spring owns how the transaction is implemented.

### Schema

```text
yakable-dao/src/main/resources/db/migration/yakable/
├── V1__create_project.sql
├── V2__create_session.sql
├── V3__create_turn.sql
├── V4__create_message.sql
├── V5__add_turn_execution_recovery.sql
└── V6__add_read_model_indexes.sql
```

Flyway owns schema evolution. Never edit an applied migration; add a new version.

## REST boundary

```text
yakable-interfaces/src/main/java/io/yakable/interfaces/rest/
├── RestExceptionHandler.java
├── project/ProjectController.java
└── session/SessionController.java
```

A controller should only:

```text
validate transport input
-> create command/query input
-> call Application
-> map output
```

If a controller starts coordinating repositories, DAO, model calls, async execution, or domain transitions, the logic belongs elsewhere.

## Boot / configuration

```text
yakable-boot/src/main/java/io/yakable/boot/
├── YakableApplication.java
└── configuration/
    ├── ApplicationConfiguration.java
    ├── AsyncConfiguration.java
    ├── ModelConfiguration.java
    └── properties/
        ├── ModelProperties.java
        └── TurnExecutionProperties.java
```

Use Boot for composition and runtime configuration only.

Do not move business rules into configuration classes.

## Important tests

### Application flow

```text
yakable-application/src/test/java/io/yakable/application/session/
└── SessionFlowTest.java
```

### Persistence

```text
yakable-dao/src/test/java/io/yakable/dao/
├── DaoPersistenceIntegrationTest.java
└── ReadModelIntegrationTest.java
```

### HTTP / boot integration

```text
yakable-boot/src/test/java/io/yakable/boot/
├── project/ProjectControllerTest.java
└── session/SessionControllerTest.java
```

When changing behavior, include the closest relevant test in context before expanding to unrelated code.

## Task-to-context recipes

These are baseline context recipes. They are intentionally small.

### Review Session / Turn / Message architecture

Load:

```text
docs/architecture/session-domain.md
yakable-domain/.../session/
yakable-application/.../session/
SessionFlowTest.java
```

Add DAO only if the question touches persistence or atomicity.

Add async infrastructure only if the question touches dispatch/recovery.

### Change Turn execution

Load:

```text
TurnExecutor.java
Turn.java
TurnStatus.java
SessionExecutionRepository.java
ModelGateway.java
SessionFlowTest.java
```

Then expand according to the concrete failure or behavior.

### Change model context / prompting

Load:

```text
TurnExecutor.java
application/context/ContextPolicy.java
application/context/DefaultContextPolicy.java
application/context/ContextBundle.java
application/context/ModelInvocationCompiler.java
ModelRequest.java
ModelMessage.java
ModelGateway.java
docs/architecture/context-harness.md
docs/architecture/frontend-domain-harness.md
```

Do not load concrete provider clients unless provider behavior is relevant.

### Change model provider integration

Load:

```text
ModelGateway.java
PluginModelGateway.java
ModelPlugin.java
LlmRequest.java
the concrete provider plugin
its provider test
```

### Change a database operation

Load:

```text
the Domain repository contract
the RepositoryAdapter
the DAO interface
the MyBatis implementation / Mapper
the relevant PO
the closest integration test
```

### Change API behavior

Load:

```text
the Controller
the called Application service
the request/result domain/application types
the controller integration test
```

## Context expansion rule

Start from the smallest deterministic set.

Expand only when one of these is true:

- a referenced type is required to understand behavior;
- a cross-module invariant is involved;
- a test exposes behavior not visible in the entry point;
- persistence or provider details materially affect the task;
- current evidence is insufficient to make a safe change.

The model may request additional context, but the System should own:

- allowed paths;
- maximum file/content budget;
- ordering;
- deduplication;
- truncation/compaction;
- whether a requested source is actually admitted into model context.

> **The model can request context. The System owns context.**
