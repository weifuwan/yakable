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

Provider and model belong to Session because different sessions of the same project may use different model configurations in the future.

### Turn

A Turn is one execution initiated by one user input.

It owns execution lifecycle:

```text
PENDING
RUNNING
SUCCEEDED
FAILED
```

A Turn is not defined as exactly one user message plus one assistant message.

Today a successful Turn produces those two messages. Future Agent execution may add tool calls, tool results, file changes, approvals, and other events without changing Session identity.

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

Failed Turn messages are retained for audit/UI state but are not automatically included in later model context.

## Project bootstrap

Creating a project starts its first Session and first Turn in the same application operation:

```text
POST /api/projects
  -> create Project
  -> create Session
  -> create PENDING Turn
  -> persist USER Message
  -> dispatch Turn execution
  -> return project + session identity immediately
```

The frontend can navigate immediately to:

```text
/dashboard/project/:projectId/session/:sessionId
```

Opening a Session page is read-only. Page mount must never create the initial message or start a Turn.

## Session API

Read current Session state:

```http
GET /api/sessions/{sessionId}
```

The response is a snapshot containing Session metadata, Turns, and Messages.

Start a new Turn:

```http
POST /api/sessions/{sessionId}/turns
```

The request persists the USER message and returns `202 Accepted` with a PENDING Turn. Execution happens independently through the Turn dispatcher.

The frontend may poll the Session snapshot while a Turn is `PENDING` or `RUNNING`. Streaming can replace polling later without changing the domain model.

## Model boundary

Session owns model selection but does not know provider HTTP details.

```text
SessionService
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

This rule prevents a failed/incomplete execution from silently contaminating later prompts.

## Current persistence

Repositories are currently in-memory adapters.

That is an infrastructure limitation, not a domain rule. Replacing them with database repositories must preserve:

- Session identity independent from Project identity;
- explicit Turn status;
- stable Message sequence;
- one active Turn per Session;
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
