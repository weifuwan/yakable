# Java Backend Architecture

Yakable backend keeps module boundaries small and package responsibilities clear.

## Backend modules

```text
yakable-api          # domain + application + REST + non-database infrastructure
yakable-dao          # MyBatis-Plus persistence + Flyway
yakable-boot         # Spring Boot composition and runtime configuration
yakable-plugins      # model provider plugins
yakable-common       # business-agnostic shared code
yakable-bom          # dependency version alignment
```

The former `yakable-spi`, `yakable-domain`, `yakable-application`,
`yakable-infrastructure` and `yakable-interfaces` modules are merged into
`yakable-api`.

## Dependency direction

```text
yakable-boot
├── yakable-api
├── yakable-dao
└── yakable-plugins

yakable-dao
└── yakable-api

yakable-api
├── yakable-common
└── model plugin API

yakable-plugin-model-*
└── model plugin API
```

## yakable-api packages

Module merging does not remove code responsibilities.

```text
io.yakable
├── domain          # business model, invariants, repository contracts
├── application     # use cases and application ports
├── interfaces      # REST and other inbound adapters
├── infrastructure  # async/model/external-system implementations
└── spi             # stable extension contracts when needed
```

Rules:

- package responsibility remains explicit even when code lives in one Maven module;
- domain code must not depend on REST, persistence, provider implementations or Boot;
- application coordinates domain objects and ports;
- interfaces handles transport only;
- infrastructure handles non-database technology integration;
- do not create a new Maven module just to express a package boundary.

## yakable-dao

`yakable-dao` owns relational persistence.

```text
Repository
    ↓
RepositoryImpl
    ↓
Mapper
    ↓
Entity
    ↓
Database
```

Detailed persistence rules are defined in `yakable-dao/README.md`.

## yakable-plugins

Model providers remain independent plugin modules and are discovered with
AutoService / ServiceLoader.

`yakable-api` depends only on the model plugin API, never on a concrete
provider implementation.

## yakable-boot

`yakable-boot` is the composition root.

It owns:

- Spring Boot entrypoint;
- runtime configuration;
- configuration properties;
- bean wiring.

Business rules do not belong in Boot.

## yakable-common

`yakable-common` contains business-agnostic shared code only.

Do not move domain/application code into common just to reuse it.

## Design rule

Prefer package boundaries before Maven module boundaries.

Create a new Maven module only when there is a real independent build,
dependency, extension or deployment boundary.
