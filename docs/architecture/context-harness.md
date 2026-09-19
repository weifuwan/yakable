# Context Harness

> **The model may request context. The System owns context.**

This document defines the first runtime Context Harness boundary in Yakable.

## Goal

Context must not be an accidental side effect of conversation history or unrestricted model-driven repository search.

Yakable should have an explicit System-owned boundary that decides:

- what information is eligible for model context;
- what is excluded;
- how approved context is ordered;
- how approved context becomes a model invocation.

The model can later request additional information, but a request is not permission. System policy decides whether that information is admitted.

## Current runtime

PR3 establishes this path:

```text
TurnExecutor
  -> load Session candidates
  -> ContextPolicy
  -> ContextBundle
  -> ModelInvocationCompiler
  -> ModelRequest
  -> ModelGateway
```

### ContextPolicy

`ContextPolicy` owns admission rules.

The initial `DefaultContextPolicy` intentionally preserves existing conversation behavior:

```text
all Messages from SUCCEEDED prior Turns
+
Messages from the current Turn
```

Messages from failed prior Turns remain durable for audit/UI state but are not automatically admitted to the next model invocation.

The policy also rejects cross-Session contamination by admitting only Turns and Messages belonging to the current Session.

### ContextBundle

`ContextBundle` is the result of System context selection.

Today it contains:

```text
system instructions
+
approved conversation
```

It is deliberately separate from `ModelRequest`. Context is a Yakable product concern; `ModelRequest` is the model boundary.

### ModelInvocationCompiler

`ModelInvocationCompiler` converts an already-approved `ContextBundle` into the provider-neutral `ModelRequest`.

It does not decide what context is allowed.

```text
Policy decides.
Compiler translates.
Gateway executes.
```

## Why TurnPromptAssembler was removed

The previous `TurnPromptAssembler` mixed context ownership with translation of Session Messages into Model Messages. The name also hid which rules controlled the result.

The new boundary makes responsibility explicit and gives future Harness work one stable place to evolve.

## Not in PR3

This phase intentionally does not add:

- repository file retrieval;
- `MODULE.md` loading at runtime;
- architecture-document loading at runtime;
- semantic search or embeddings;
- model-controlled arbitrary file search;
- token budgets or compaction;
- dynamic context requests;
- tool calls;
- RAG.

Those capabilities should be added behind `ContextPolicy`, not around it.

## Evolution path

```text
1. deterministic project/module context sources
2. task-to-context routing
3. context budget and ordering
4. bounded model context requests
5. compaction / retrieval when scale requires it
```

The invariant should remain:

> **System supplies the reliable baseline. The model asks for missing information. System decides what enters the context window.**
