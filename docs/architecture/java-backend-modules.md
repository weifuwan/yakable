# Java Backend Modules

Yakable adopts the same high-level Maven multi-module shape used by Yak Ops, while keeping the first backend baseline intentionally small.

```text
yakable-bom
  └── dependency version alignment

yakable-boot
    ↓
yakable-core
    ↓
yakable-spi
    ↓
yakable-common
```

The browser application remains in `dashboard/`.

## Module ownership

### yakable-bom

Owns dependency alignment for Yakable Java modules.

It contains no runtime code.

### yakable-common

Owns framework-independent shared value objects and utilities.

Rules:

- no Spring dependency;
- no dependency on SPI, Core, or Boot;
- do not put business orchestration here.

### yakable-spi

Owns stable extension contracts and ports.

Future examples may include model, workspace, storage, or tool extension contracts, but they should only be added when a concrete boundary is understood.

Rules:

- may depend on Common;
- must not depend on Core or Boot;
- provider implementations do not belong here.

### yakable-core

Owns Yakable's frontend-domain capabilities and runtime coordination.

This is the future home of deterministic Harness behavior and backend orchestration.

Rules:

- may depend on SPI and Common;
- must not depend on Boot;
- HTTP controllers and browser-specific code do not belong here.

### yakable-boot

Owns application assembly, Spring Boot startup, and HTTP-facing adapters.

It is the outermost Java module.

## Dependency direction

Dependencies flow inward only:

```text
Boot -> Core -> SPI -> Common
```

A lower module must never depend on a higher module.

## Current migration boundary

This commit only establishes the Java build and module boundaries.

Existing TypeScript backend code remains in place temporarily. Capabilities should be migrated one at a time after their ownership and contract are understood.

Browser-native behavior stays in `dashboard/`.
