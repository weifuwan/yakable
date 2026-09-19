# Session Domain

Yakable separates long-lived project identity from conversational and execution state.

## Domain model

```text
Project
  └── Session
       └── Turn
            └── Message
```

### Project

A Project is the long-lived frontend workspace.

It owns:

```text
id
name
status
createdAt
updatedAt
```

A Project does not own the initial prompt, selected model, or message history.

Cross-aggregate project/session orchestration belongs to the application layer:

```text
ProjectBootstrapService
ProjectOverviewQueryService
```

Project domain services must not directly coordinate Session execution.

### Session

A Session is one working context inside a Project.

It owns:

```text
id
projectId
title
provider
model
status
createdAt
updatedAt
```

Current status:

```text
ACTIVE
ARCHIVED
```

Provider and model belong to Session because different sessions of the same Project may use different model configurations.

A Session is also the consistency boundary for Turn creation and Message ordering.

### Turn

A Turn is one execution initiated by one user input.

Lifecycle:

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED
```

The Turn entity itself enforces valid transitions:

```text
PENDING -> RUNNING
RUNNING -> SUCCEEDED
RUNNING -> FAILED
```

No other transition is valid.

A Turn is not defined as exactly one user message plus one assistant message. Future Agent execution may add tool calls, tool results, file changes, approvals, and other events without changing Session identity.

Only one active Turn is allowed in a Session at a time.

### Message

A Message is an immutable conversational record.

It owns:

```text
id
sessionId
turnId
role
content
sequence
createdAt
```

Message ordering is explicit through `sequence`; repository iteration order is not part of the contract.

Sequence allocation and Message persistence are one repository operation. Callers must never request a sequence first and persist a Message later.

## Session execution consistency

Session execution writes are expressed through `SessionExecutionRepository` instead of composing generic repository methods.

The repository must atomically guarantee these operations:

```text
createPendingTurn
  -> verify there is no active Turn in the Session
  -> create PENDING Turn
  -> allocate Message sequence
  -> persist USER Message

claimPendingTurn
  -> PENDING -> RUNNING only if the Turn is still PENDING

completeTurn
  -> allocate Message sequence
  -> persist ASSISTANT Message
  -> RUNNING -> SUCCEEDED

failTurn
  -> RUNNING -> FAILED
```

This prevents:

- two concurrent active Turns in one Session;
- duplicate model execution after repeated dispatch;
- duplicate Message sequence allocation;
- assistant Message persistence without a matching SUCCEEDED Turn.

The current in-memory adapter uses a per-Session lock. A future database adapter must preserve the same semantics with transactions, constraints, and compare-and-set updates.

## Service boundaries

The Session domain is split by responsibility:

```text
SessionCommandService
  -> create Session
  -> start Turn

SessionQueryService
  -> read Session snapshot
  -> list Project Sessions

TurnExecutor
  -> claim Turn
  -> build model context
  -> invoke ModelRuntime
  -> complete/fail Turn

TurnPromptAssembler
  -> convert Session context into LlmRequest
  -> own system prompt assembly
```

The old all-in-one `SessionService` is intentionally removed.

## Project bootstrap

Creating a Project starts its first Session and first Turn in one application use case:

```text
POST /api/projects
  -> ProjectBootstrapService
  -> create Project
  -> create Session
  -> atomically create PENDING Turn + USER Message
  -> dispatch Turn execution
  -> return Project + latestSessionId immediately
```

The frontend can navigate immediately to:

```text
/dashboard/project/:projectId/session/:sessionId
```

Opening a Session page is read-only. Page mount must never create the initial Message or start a Turn.

`ProjectBootstrapService` is the application transaction boundary. When persistent database repositories are introduced, Project + Session + initial Turn/Message persistence must run in one database transaction. The current in-memory adapters do not simulate a fake database transaction.

## Session API

Session identity is scoped under Project identity.

Read current Session state:

```http
GET /api/projects/{projectId}/sessions/{sessionId}
```

Start a new Turn:

```http
POST /api/projects/{projectId}/sessions/{sessionId}/turns
```

The backend validates that the Session belongs to the Project. A mismatched Project/Session pair is treated as not found.

The request persists the USER Message and returns `202 Accepted` with a PENDING Turn. Execution happens independently through the Turn dispatcher.

The frontend may poll the Session snapshot while a Turn is `PENDING` or `RUNNING`. Streaming can replace polling later without changing the domain model.

## Model boundary

Session owns model selection but does not know provider HTTP details.

```text
TurnExecutor
  -> TurnPromptAssembler
  -> ModelRuntime
  -> ModelPluginRegistry
  -> ModelPlugin
  -> protocol client
```

The Session domain must not instantiate DeepSeek, Kimi, OpenAI, or any concrete provider.

## Context rules

When executing a Turn, model history contains:

```text
all Messages from SUCCEEDED prior Turns
+
Messages belonging to the current Turn
```

Messages from FAILED Turns are preserved but excluded from automatic future model context.

This prevents a failed or incomplete execution from silently contaminating later prompts.

## Project read model

A Project may have multiple Sessions.

Project list/detail responses expose:

```text
latestSessionId
```

not a generic `sessionId`.

This makes the read-model semantics explicit while preserving a direct route back into the most recently active Session.

## Current persistence

Repositories are currently in-memory adapters.

That is an infrastructure limitation, not a domain rule. Replacing them with database repositories must preserve:

- Project and Session identity separation;
- Project-scoped Session access;
- explicit Turn state transitions;
- one active Turn per Session;
- atomic Turn claim;
- atomic Message sequence allocation;
- atomic Turn completion with assistant Message;
- failed-Turn context exclusion.

## Not in this phase

This refactor intentionally does not introduce:

```text
SSE / token streaming
Agent event persistence
Tool calls
Context compression
Session branching
Session summaries
database persistence
retry policies
distributed workers
```

Those capabilities should extend the Session/Turn model rather than bypass it.
