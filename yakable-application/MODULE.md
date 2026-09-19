# yakable-application

## Purpose

Own Yakable use cases, orchestration, transaction intent, durable Turn execution, read-model ports, and outbound application ports.

## Owns

- Project and Session use-case ordering
- Turn execution workflow
- System-owned context admission and model-input compilation
- transaction boundaries through `TransactionRunner`
- model boundary through `ModelGateway`
- async boundary through `TurnDispatcher`
- application query services and query ports

## Does not own

- HTTP request/response transport
- MyBatis/Flyway implementation
- Spring Boot composition
- concrete model-provider protocols
- domain invariants that belong on Domain objects

## Key entry points

```text
src/main/java/io/yakable/application/project/
src/main/java/io/yakable/application/session/
src/main/java/io/yakable/application/context/
src/main/java/io/yakable/application/model/
src/main/java/io/yakable/application/async/
src/main/java/io/yakable/application/transaction/
```

Important runtime path:

```text
SessionTurnService
  -> TurnExecutor
  -> ContextPolicy
  -> ModelInvocationCompiler
  -> ModelGateway
```

## Dependency boundary

Depends on `yakable-domain`. Production code must not depend on REST, MyBatis, Flyway, Boot, or concrete provider implementations.

## Add to context when

Load this module for workflow, orchestration, Context Harness policy, model invocation, async dispatch contracts, transaction intent, or application read behavior.

Start from the specific use case; do not load every service by default.
