# Yakable Project Map

> Fast navigation for humans and AI. Start here before scanning the repository.

This document answers one question: **where should I look first for a given Yakable task?**

It is intentionally a map, not an architecture specification. Detailed rules remain in `docs/architecture/`.

## Context reading order

When a task touches Yakable code, prefer this order:

1. Read this file to identify the relevant module or domain.
2. Read `docs/context/backend-map.md` for backend tasks.
3. Read the matching architecture document only when its rules are relevant.
4. Read the smallest set of implementation files needed for the task.
5. Expand context only when the current evidence is insufficient.

Do not scan the whole repository by default.

## Repository map

| Path | Responsibility | Start here when |
| --- | --- | --- |
| `yakable-domain/` | Business concepts, invariants, repository contracts | Changing Project / Session / Turn / Message semantics |
| `yakable-application/` | Use cases, orchestration, model execution, application ports | Changing workflows or cross-domain coordination |
| `yakable-dao/` | MyBatis-Plus persistence, repository adapters, Flyway | Changing database reads/writes or schema |
| `yakable-interfaces/` | REST transport boundary | Changing HTTP request/response contracts |
| `yakable-infrastructure/` | Non-database outbound adapters | Model runtime, async execution, future workspace/shell/git adapters |
| `yakable-boot/` | Spring Boot composition and configuration | Wiring beans or runtime properties |
| `yakable-common/` | Business-agnostic shared primitives only | Truly generic shared code |
| `yakable-spi/` | Stable extension contracts broader than one use case | Adding cross-module extension contracts |
| `yakable-plugins/` | Pluggable provider implementations | Adding or changing LLM providers |
| `yakable-ui/` | Yakable product frontend | Dashboard, Project, Session UI work |
| `templates/` | Yakable-owned generated frontend foundation | Frontend Harness templates, component packs, ownership rules |
| `docs/architecture/` | Architecture decisions and domain rules | Understanding why a boundary exists |
| `docs/context/` | Fast context routing | Finding what to read before editing |

## Backend dependency direction

```text
interfaces ───────┐
                  ▼
             application
                  ▼
               domain

dao ──────────────┘
infrastructure ───┘

boot
 ├─ interfaces
 ├─ dao
 └─ infrastructure

plugins
 └─ model plugin API
```

Dependencies should point toward business policy. Domain/Application must not depend on REST, MyBatis, Flyway, Spring Boot composition, or concrete model providers.

For detailed backend navigation, read:

```text
docs/context/backend-map.md
```

## Frontend map

```text
yakable-ui/src/
├── app/
│   ├── layout/
│   ├── navigation/
│   ├── providers/
│   ├── router/
│   └── styles/
├── features/
│   ├── model/
│   ├── project/
│   └── session/
├── pages/
│   ├── dashboard/
│   └── project/
└── shared/
    ├── api/
    ├── lib/
    └── ui/
```

Use these anchors:

| Concern | Path |
| --- | --- |
| Application shell / routes | `yakable-ui/src/app/` |
| Model selector | `yakable-ui/src/features/model/` |
| Project API and UI | `yakable-ui/src/features/project/` |
| Session conversation | `yakable-ui/src/features/session/` |
| Dashboard page | `yakable-ui/src/pages/dashboard/` |
| Project page | `yakable-ui/src/pages/project/` |
| Shared UI primitives | `yakable-ui/src/shared/ui/` |
| Shared API behavior | `yakable-ui/src/shared/api/` |

## Frontend Harness assets

The frontend-domain Harness starts from `templates/`.

Important anchors:

```text
templates/base/
├── yakable.template.json
├── AGENTS.md
├── package.json
├── src/components/ui/
└── src/styles/

templates/packs/
└── reusable capability/component packs
```

`templates/base/yakable.template.json` defines which generated-project files are Yakable-owned versus project-owned.

The philosophy and ownership boundary are documented in:

```text
docs/architecture/frontend-domain-harness.md
```

## Common task routing

### "Change Project creation"

Read:

```text
docs/context/backend-map.md
yakable-application/.../project/ProjectBootstrapService.java
yakable-domain/.../project/
yakable-domain/.../project/repository/ProjectRepository.java
```

Expand into `yakable-dao/.../project/` only when persistence behavior matters.

### "Change Session / Turn / Message"

Read:

```text
docs/architecture/session-domain.md
docs/context/backend-map.md
yakable-domain/.../session/
yakable-application/.../session/
```

Expand into DAO or async infrastructure only when the task requires it.

### "Change model calling"

Read:

```text
docs/context/backend-map.md
yakable-application/.../model/
yakable-infrastructure/.../model/
yakable-plugins/yakable-plugin-model/
```

### "Change database schema"

Read:

```text
yakable-dao/src/main/resources/db/migration/yakable/
yakable-dao/src/main/java/io/yakable/dao/
```

Do not modify an already-applied Flyway migration.

### "Change REST API"

Read:

```text
yakable-interfaces/src/main/java/io/yakable/interfaces/rest/
```

Then follow the called Application use case instead of jumping directly to DAO.

### "Change generated frontend foundation"

Read:

```text
docs/architecture/frontend-domain-harness.md
templates/base/yakable.template.json
templates/base/AGENTS.md
templates/base/
```

### "Change Yakable product UI"

Start in:

```text
yakable-ui/src/features/<domain>/
yakable-ui/src/pages/
```

Use `shared/` only for genuinely shared UI/API primitives.

## Context rule

A useful Yakable task context should usually be:

```text
project map
+ relevant domain map / architecture rule
+ task entry point
+ directly related domain/application contracts
+ related tests
+ extra files requested only when evidence is missing
```

Avoid treating the entire repository, the entire chat history, or every related file as default model context.

The goal is:

> **System provides the reliable baseline context. The model requests only the missing remainder.**
