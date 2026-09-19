# Session Domain

Yakable separates long-lived Project identity from conversational and execution state.

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

Cross-aggregate Project/Session orchestration belongs to `yakable-application`:

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

Provider and model belong to Session because different sessions of the same Project may use different model configurations.

A Session is also the consistency boundary for Turn creation and Message ordering.

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

A Turn is not defined as exactly one USER Message plus one ASSISTANT Message. Future Agent execution may add tool calls, tool results, file changes, approvals, and other events without changing Session identity.

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

## Persistence boundary

Repository contracts live in `yakable-domain`. MyBatis-Plus implementations live in `yakable-dao`.

```text
SessionExecutionRepository
  -> SessionExecutionRepositoryAdapter
  -> SessionExecutionDao
  -> TurnMapper / MessageMapper
  -> yak_turn / yak_message
```

`SessionExecutionRepository` must atomically guarantee:

```text
createPendingTurn
  -> lock Session row FOR UPDATE
  -> verify no active Turn exists
  -> create PENDING Turn
  -> allocate Message sequence
  -> persist USER Message

claimPendingTurn
  -> conditional UPDATE
  -> PENDING -> RUNNING only when still PENDING

completeTurn
  -> lock Session row FOR UPDATE
  -> RUNNING -> SUCCEEDED with conditional UPDATE
  -> allocate Message sequence
  -> persist ASSISTANT Message

failTurn
  -> RUNNING -> FAILED with conditional UPDATE
```

Database constraints include:

```text
PRIMARY KEY for Project / Session / Turn / Message
FOREIGN KEY Project -> Session -> Turn / Message
UNIQUE (session_id, message_sequence)
INDEX (session_id, status)
```

This preserves:

- one active Turn per Session;
- duplicate execution protection;
- unique ordered Message sequence;
- no ASSISTANT Message without a matching successful Turn transition.

## Application transactions

Application owns transaction boundaries through `TransactionRunner`; the DAO module implements them with Spring transactions.

Project bootstrap:

```text
transaction
  -> create Project
  -> create Session
  -> create initial PENDING Turn + USER Message
  -> touch Session
commit
  -> dispatch Turn
```

New Session Turn:

```text
transaction
  -> create PENDING Turn + USER Message
  -> touch Session
commit
  -> dispatch Turn
```

Model execution deliberately does not hold a database transaction:

```text
claim Turn transaction
commit

build context
call ModelGateway

success:
  transaction
    -> complete Turn
    -> persist ASSISTANT Message
    -> touch Session
  commit

failure:
  transaction
    -> fail Turn
    -> touch Session
  commit
```

The slow external LLM call is therefore outside a database transaction.

## Application services

```text
SessionCommandService
  -> create Session
  -> persist/start Turn

SessionTurnService
  -> transaction around Turn creation
  -> request dispatch after commit

SessionQueryService
  -> read Session snapshot
  -> list Project Sessions

TurnExecutor
  -> atomically claim Turn
  -> build model context
  -> call ModelGateway outside DB transaction
  -> persist completion/failure in a short transaction

TurnPromptAssembler
  -> convert Session context into ModelRequest
  -> own system-prompt assembly
```

The REST layer does not coordinate these steps.

## Project bootstrap

```text
POST /api/projects
  -> ProjectController
  -> ProjectBootstrapService
       -> TransactionRunner
            -> ProjectRepository
            -> SessionRepository
            -> SessionExecutionRepository
       -> TurnDispatcher after commit
  -> return Project + latestSessionId
```

The frontend can navigate immediately to:

```text
/dashboard/project/:projectId/session/:sessionId
```

Opening a Session page is read-only. Page mount must never create the initial Message or start a Turn.

## Session API

Read current Session state:

```http
GET /api/projects/{projectId}/sessions/{sessionId}
```

Start a new Turn:

```http
POST /api/projects/{projectId}/sessions/{sessionId}/turns
```

The backend validates that the Session belongs to the Project. A mismatched Project/Session pair is treated as not found.

The write request commits the USER Message before requesting asynchronous execution.

The current dispatcher uses virtual threads. A queue or distributed worker can replace it without changing the REST or Domain model.

## Model boundary

```text
TurnExecutor
  -> TurnPromptAssembler
  -> ModelGateway                  # Application port
  -> PluginModelGateway            # Infrastructure adapter
  -> ModelPluginRegistry
  -> ModelPlugin
  -> protocol client
```

Domain and Application do not import the model plugin API.

Adding a provider must not require changing `TurnExecutor`.

## Context rules

When executing a Turn, model history contains:

```text
all Messages from SUCCEEDED prior Turns
+
Messages belonging to the current Turn
```

Messages from FAILED Turns are preserved but excluded from automatic future model context.

## Current persistence

Persistence is now MySQL-backed through MyBatis-Plus.

Flyway owns the schema:

```text
yak_project
yak_session
yak_turn
yak_message
yakable_schema_history
```

Tests run the same migrations against H2 in MySQL compatibility mode and verify transaction rollback, ordered Message persistence, and concurrent active-Turn exclusion.

## Not in this phase

This persistence refactor intentionally does not introduce:

```text
SSE / token streaming
Agent event persistence
Tool calls
Context compression
Session branching
Session summaries
retry policies
distributed workers
```

Those capabilities should extend the existing Session/Turn and persistence boundaries rather than bypass them.
