# yakable-domain

## Purpose

Own Yakable business concepts, invariants, state transitions, domain exceptions, and repository contracts.

## Owns

- `Project`, `Session`, `Turn`, `SessionMessage`
- status and lifecycle rules
- domain-level exceptions
- repository ports required by business behavior

## Does not own

- REST or transport DTOs
- Spring configuration
- MyBatis/Flyway details
- concrete model providers
- application use-case orchestration

## Key entry points

```text
src/main/java/io/yakable/domain/project/
src/main/java/io/yakable/domain/session/
src/main/java/io/yakable/domain/**/repository/
```

## Dependency boundary

Production code should remain framework-independent. This module must not depend on Application, DAO, Interfaces, Infrastructure, Boot, or provider plugins.

## Add to context when

Load this module when a task changes business truth: entity state, lifecycle rules, invariants, repository semantics, or domain exceptions.

Do not load the whole module for a transport-, provider-, or UI-only change.
