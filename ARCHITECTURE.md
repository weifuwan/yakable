# Yakable Backend Architecture

Status: Active

Scope:
- Yakable Java backend modules
- Backend module ownership and dependency direction

Depends On:
- `docs/engineering-context-model.md`

## Principle

Backend code is organized by ownership, not by file size, framework annotation, or naming convenience.

Spring is an implementation tool. Whether a class uses Spring does not decide whether it belongs to Core, Service, DAO, or Boot.

## Module Ownership

### `yakable-common`

Owns shared contracts and utilities that do not have a more specific business or runtime owner.

It must not become a place to bypass module ownership.

### `yakable-core`

Owns stable core capabilities and runtime mechanisms.

Typical Core responsibilities include:

- stable runtime contracts
- runtime state machines
- bounded in-memory runtime state
- concurrency and lifecycle mechanisms
- provider-independent runtime behavior

Core may use Spring facilities when they directly support a Core capability, such as dependency injection, configuration, or lifecycle management.

Core does not own business persistence, HTTP transport, or domain transaction orchestration.

### `yakable-plugins`

Owns concrete provider and extension implementations.

Plugins adapt to stable Core contracts. Core must not depend on concrete Plugin implementations.

### `yakable-dao`

Owns persistence implementation:

- Entity
- Mapper
- Repository
- database queries and updates
- Flyway migrations

DAO does not own business workflow.

### `yakable-service`

Owns domain facts and business behavior:

- business rules
- state transitions
- ownership checks
- transaction orchestration
- persistence-facing workflows
- collaboration between domain services and Core runtime capabilities

Service decides business policy. It should consume stable Core runtime mechanisms instead of embedding an unrelated runtime state machine inside a business service when a real Core boundary exists.

### `yakable-boot`

Owns application delivery and assembly:

- Spring Boot application entry
- HTTP
- SSE transport
- Security
- Controller
- application configuration and final module assembly

Boot translates transport concerns into Service or Core contracts. Transport lifecycle must not become the source of business truth.

## Dependency Direction

Current backend dependency direction is:

```text
Boot
 ├─→ Service ─→ Core ─→ Common
 │      └─────→ DAO ──→ Common
 ├────────────→ DAO
 └────────────→ Plugins ─→ Core
```

Rules:

- Core must not depend on Service, DAO, Boot, or concrete Plugin implementations.
- Service may depend on Core, DAO, and Common.
- Plugins may depend on Core contracts and plugin APIs, not Service business implementations.
- DAO depends downward on persistence dependencies and Common, not Service.
- Boot is the final assembly layer and may depend on the modules it assembles.

## Core vs Service

Use Core when the capability still makes sense without a specific business table or Service and has a stable runtime boundary of its own.

Strong Core signals include:

- an independent lifecycle
- an explicit state machine
- concurrency or resource-bound rules
- stable runtime input/output contracts
- reuse across more than one business workflow, or clear independence from one domain transaction

Use Service when the behavior decides or persists business facts.

Strong Service signals include:

- ownership or authorization at the domain level
- database transaction boundaries
- Session / Turn / Message business state transitions
- idempotency or business conflict rules
- persistence and activity updates
- policy that depends on domain status or stored history

Spring annotations are not a decision criterion.

## Transport Boundary

HTTP and SSE framing stay in Boot.

For example:

```text
SseEmitter
HTTP status
request / response mapping
security principal
```

must not define Core or Service ownership.

A Runtime watcher can be Core while the `SseEmitter` adapter remains Boot.

## Persistence Boundary

Persistent business facts remain owned by Service + DAO.

Core runtime state must not become the only source of truth for persistent domain facts.

A runtime mechanism may hold bounded temporary state, but durable Session / Turn / Message state still converges through Service and DAO.

## Current Facts

- LLM runtime contracts live in `yakable-core/src/main/java/io/yakable/core/llm`.
- Session business orchestration lives in `yakable-service/src/main/java/io/yakable/service/session`.
- Turn and Message business persistence boundaries already have their own Services.
- Conversation HTTP and SSE transport live in `yakable-boot`.
- Model provider implementations adapt Core contracts through the plugin modules.

## Known Ownership Gap

Conversation Streaming already has a stable capability contract for:

```text
buffer
snapshot / delta / terminal
watcher subscription
watcher isolation
stop cutover
```

The current implementation of that runtime is still embedded inside `SessionServiceImpl`.

This is an ownership gap, not a request to change Conversation behavior. A later migration must preserve the existing Capability Contracts, scenarios, tests, and transport behavior instead of rewriting the feature.

## Refactor Rule

Architecture refactors migrate existing facts; they do not recreate them.

Before moving code across modules:

```text
Capability Contract
→ Architecture ownership
→ nearest RULES
→ existing code and tests
→ minimal migration
→ test / CI verification
```

Must:

- preserve existing product behavior unless the Capability Contract changes first
- reuse existing implementation where possible
- move tests according to ownership while keeping cross-layer behavior evidence
- keep CI verification valid throughout the migration

Must Not:

- delete working behavior and rebuild it only to match a preferred architecture
- add Manager / Coordinator / Handler / Assembler layers for symmetry
- split interfaces or classes only because a file is long
- move persistence business rules into Core merely to reduce Service size
