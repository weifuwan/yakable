# yakable-infrastructure

## Purpose

Own non-database outbound technology adapters.

## Owns

- `ModelGateway` adaptation to model plugins
- model plugin discovery/configuration
- async Turn dispatch implementation
- Turn recovery worker
- future external adapters such as workspace, shell, git, storage, or broker integration

## Does not own

- relational persistence
- business invariants
- REST contracts
- use-case policy
- provider-specific business decisions

## Key entry points

```text
src/main/java/io/yakable/infrastructure/model/
├── PluginModelGateway.java
├── ModelPluginRegistry.java
└── ModelPluginConfigurationResolver.java

src/main/java/io/yakable/infrastructure/async/
├── VirtualThreadTurnDispatcher.java
└── TurnRecoveryWorker.java
```

## Dependency boundary

Implements Application ports. It may depend on technology/plugin APIs, but Application must not depend back on Infrastructure.

Database persistence belongs in `yakable-dao`, not here.

## Add to context when

Load this module for adapter behavior, plugin runtime integration, async execution mechanics, recovery scheduling, or future external-system integration.

For provider protocol details, expand into the specific plugin module instead of loading all plugins.
