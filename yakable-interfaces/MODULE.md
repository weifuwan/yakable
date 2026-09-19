# yakable-interfaces

## Purpose

Own inbound transport adapters. Today this primarily means REST controllers and transport-level exception mapping.

## Owns

- HTTP path/method contracts
- request validation
- transport DTO mapping
- HTTP response mapping
- REST exception translation

## Does not own

- repository access
- DAO/Mapper calls
- model-provider calls
- async dispatch implementation
- domain state transitions
- multi-step business orchestration

## Key entry points

```text
src/main/java/io/yakable/interfaces/rest/
├── RestExceptionHandler.java
├── project/ProjectController.java
└── session/SessionController.java
```

Controller flow should remain:

```text
validate input
-> create command/query input
-> call Application
-> map response
```

## Dependency boundary

Depends inward on Application/Domain contracts and on transport frameworks. It must not reach directly into DAO, Infrastructure, or provider plugins.

## Add to context when

Load this module for API shape, HTTP validation, response mapping, status/error behavior, or controller integration.

Do not load it for internal workflow changes with no transport impact.
