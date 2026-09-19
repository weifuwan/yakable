# Session Domain

Yakable separates long-lived Project identity from conversational and execution
state.

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

Cross-aggregate Project/Session orchestration belongs to
`yakable-application`:

```text
ProjectBootstrapService
ProjectOverviewQueryService
```

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

Provider and model belong to Session because different sessions of the same
Project may use different model configurations.

A Session is also the consistency boundary for Turn creation and Message
ordering.

### Turn

A Turn is one execution initiated by one user input.

Lifecycle:

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED
```

The Turn entity enforces valid transitions:

```text
PENDING -> RUNNING
RUNNING -> SUCCEEDED
RUNNING -> FAILED
```

A Turn is not defined as exactly one USER Message plus one ASSISTANT Message.
Future Agent execution may add tool calls, tool results, file changes,
approvals, and other events without changing Session identity.

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

Message ordering is explicit through `sequence`; repository iteration order is
not part of the contract.

Sequence allocation and Message persistence are one repository operation.
Callers must never request a sequence first and persist a Message later.

## Repository consistency boundary

Repository contracts live in `yakable-domain`. Implementations live in
`yakable-infrastructure`.

`SessionExecutionRepository` must atomically guarantee:

```text
createPendingTurn
  -> verify no active Turn exists in the Session
  -> create PENDING Turn
  -> allocate Message sequence
  -> persist USER Message

claimPendingTurn
  -> PENDING -> RUNNING only when still PENDING

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

The current in-memory adapter uses a per-Session lock. A future database adapter
must preserve the same semantics using transactions, constraints, and
compare-and-set updates.

## Application services

Session use cases live in `yakable-application`:

```text
SessionCommandService
  -> create Session
  -> persist/start Turn

SessionTurnService
  -> start Turn
  -> request async dispatch

SessionQueryService
  -> read Session snapshot
  -> list Project Sessions

TurnExecutor
  -> claim Turn
  -> build model context
  -> call ModelGateway
  -> complete/fail Turn

TurnPromptAssembler
  -> convert Session context into ModelRequest
  -> own system-prompt assembly
```

The REST layer does not coordinate these steps.

## Project bootstrap

Creating a Project starts its first Session and first Turn in one application
use case:

```text
POST /api/projects
  -> ProjectController
  -> ProjectBootstrapService
       -> create Project
       -> create Session
       -> atomically create PENDING Turn + USER Message
       -> TurnDispatcher
  -> return Project + latestSessionId immediately
```

The frontend can navigate immediately to:

```text
/dashboard/project/:projectId/session/:sessionId
```

Opening a Session page is read-only. Page mount must never create the initial
Message or start a Turn.

When database repositories are introduced, Project + Session + initial
Turn/Message persistence should have an explicit transaction boundary.
Dispatch should happen after durable state is available.

## Session API

Read current Session state:

```http
GET /api/projects/{projectId}/sessions/{sessionId}
```

Start a new Turn:

```http
POST /api/projects/{projectId}/sessions/{sessionId}/turns
```

The backend validates that the Session belongs to the Project. A mismatched
Project/Session pair is treated as not found.

The write request persists the USER Message and returns `202 Accepted` with a
PENDING Turn. The Application layer requests execution through
`TurnDispatcher`; the Infrastructure layer decides how dispatch is performed.

The current adapter uses virtual threads. A queue or distributed worker can
replace it without changing the REST or Domain model.

## Model boundary

Session owns model selection but does not know provider HTTP details.

```text
TurnExecutor
  -> TurnPromptAssembler
  -> ModelGateway                  # application port
  -> PluginModelGateway            # infrastructure adapter
  -> ModelPluginRegistry
  -> ModelPlugin
  -> protocol client
```

The Domain and Application layers do not import the model plugin API.

Adding a provider must not require changing `TurnExecutor`.

## Context rules

When executing a Turn, model history contains:

```text
all Messages from SUCCEEDED prior Turns
+
Messages belonging to the current Turn
```

Messages from FAILED Turns are preserved but excluded from automatic future
model context.

This prevents failed or incomplete execution from silently contaminating later
prompts.

## Project read model

A Project may have multiple Sessions.

Project list/detail responses expose:

```text
latestSessionId
```

rather than a generic `sessionId`.

## Current persistence

Repositories are currently in-memory infrastructure adapters.

Replacing them with database repositories must preserve:

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

Those capabilities should extend the existing boundaries rather than bypass
them.
