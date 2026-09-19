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

Cross-aggregate Project/Session orchestration belongs to `yakable-application`.

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

A Session is the consistency boundary for Turn creation and Message ordering.

### Turn

A Turn is one durable execution initiated by one user input.

It owns:

```text
id
sessionId
status
attemptCount
errorMessage
startedAt
finishedAt
createdAt
updatedAt
```

Lifecycle:

```text
PENDING -> RUNNING -> SUCCEEDED
                    -> FAILED

RUNNING --recovery--> PENDING
```

A recovery keeps `attemptCount` and clears the timestamps for the abandoned attempt. The next successful claim increments `attemptCount`.

State rules:

```text
PENDING
  -> no startedAt / finishedAt / error

RUNNING
  -> attemptCount > 0
  -> startedAt required
  -> finishedAt absent

SUCCEEDED
  -> startedAt + finishedAt required

FAILED
  -> startedAt + finishedAt + errorMessage required
```

A Turn is not exactly one USER Message plus one ASSISTANT Message. Future Agent execution may attach tool calls, tool results, file changes, approvals, and other events to the same Turn.

Only one active Turn is allowed in a Session at a time.

### Message

A Message is an immutable conversational record.

```text
id
sessionId
turnId
role
content
sequence
createdAt
```

Message ordering is explicit through `sequence`.

## Durable execution model

Persisted Turn state is the execution source of truth.

```text
POST user input
  -> transaction
       -> PENDING Turn
       -> USER Message
     commit

  -> best-effort immediate dispatch
  -> periodic recovery worker also scans PENDING Turns
```

The in-process virtual-thread dispatcher is only a low-latency wake-up mechanism. Losing one dispatch does not lose the task because the PENDING Turn remains in MySQL.

### Claim

```sql
UPDATE yak_turn
SET status = 'RUNNING',
    attempt_count = attempt_count + 1,
    started_at = ?
WHERE id = ?
  AND status = 'PENDING'
```

The conditional update is the execution claim. Duplicate dispatches are safe because only one claimant can update one PENDING Turn.

### Failure boundary

Once a Turn has been claimed, the whole execution phase is guarded:

```text
build context
assemble prompt
call model
persist success
```

A RuntimeException anywhere in that phase attempts to persist FAILED state. If failure persistence itself is unavailable, the original exception is preserved and the stale-RUNNING recovery path remains the fallback.

### Stale RUNNING recovery

A periodic worker:

```text
RUNNING with startedAt < now - runningTimeout
  -> PENDING
  -> clear startedAt / finishedAt / error
  -> redispatch
```

Default baseline:

```text
recovery interval = 5s
running timeout   = 10m
batch size        = 100
```

Configuration:

```yaml
yakable:
  turn-execution:
    recovery-enabled: true
    recovery-interval: 5s
    running-timeout: 10m
    recovery-batch-size: 100
```

This is intentionally a single-node recovery baseline. Before running long-lived Agent Turns or multiple active application nodes, this timeout model should evolve into an explicit renewable execution lease.

## Persistence boundary

Repository contracts live in `yakable-domain`; MyBatis-Plus implementations live in `yakable-dao`.

`SessionExecutionRepository` owns atomic execution semantics:

```text
createPendingTurn
claimPendingTurn
completeTurn
failTurn
recoverStaleRunningTurns
findPendingTurnIds
```

Database constraints preserve Session Message ordering and relational integrity.

Flyway migration `V5__add_turn_execution_recovery.sql` adds execution timestamps, attempt count, and the recovery scan index without mutating older migrations.

## Application transactions

Project bootstrap:

```text
transaction
  -> Project
  -> Session
  -> initial Turn + USER Message
commit
  -> best-effort dispatch
```

New Turn:

```text
transaction
  -> PENDING Turn + USER Message
  -> touch Session
commit
  -> best-effort dispatch
```

Model execution:

```text
claim Turn transaction
commit

build context
call ModelGateway

success:
  transaction
    -> SUCCEEDED
    -> ASSISTANT Message
    -> touch Session
  commit

failure:
  transaction
    -> FAILED
    -> touch Session
  commit
```

The slow external model call remains outside a database transaction.

## Session API

```http
GET /api/projects/{projectId}/sessions/{sessionId}

POST /api/projects/{projectId}/sessions/{sessionId}/turns
```

The Turn response exposes `attemptCount`, `startedAt`, and `finishedAt` so execution state is observable without exposing persistence details.

## Model boundary

```text
TurnExecutor
  -> TurnPromptAssembler
  -> ModelGateway
  -> PluginModelGateway
  -> ModelPlugin
```

Domain and Application do not know concrete model providers.

## Context rules

Model history contains:

```text
all Messages from SUCCEEDED prior Turns
+
Messages belonging to the current Turn
```

Messages from FAILED Turns are retained for audit/UI state but excluded from automatic future model context.

## Not in this phase

This recovery baseline intentionally does not introduce:

```text
distributed execution lease
worker ownership / heartbeat
MQ
retry backoff
maximum-attempt policy
SSE / token streaming
Agent events
Tool calls
context compression
```

Those can extend the durable Turn boundary later.
