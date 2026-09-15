# Context Layer

`src/context` is the model-context assembly boundary for Yakable.

It answers one question: **what should a model call know for this turn?**

It does not own persistence, project mutation, prompt wording, provider transport, or Agent workflow orchestration.

## v1 foundation

PR1 intentionally introduces contracts only and does not change existing Agent behavior.

```text
Projects / Conversation / Planning / Runtime / Tools
                       ↓
                ContextProvider
                       ↓
                 ContextBuilder
                       ↓
                ContextSnapshot
                       ↓
              Prompt / Model call
```

The initial contracts are:

- `ContextSnapshot` — immutable-by-contract description of the assembled model input for one turn.
- `ContextBudget` — explicit model-window and reserved-output limits; token estimation and compaction are intentionally deferred.
- `ContextProvider` — one bounded source of context such as conversation continuity, project source, plan state, runtime evidence, or tool output.
- `ContextBuilder` — normalizes the request, collects providers deterministically, and rejects ambiguous duplicate provider/section identifiers.

## Context is not execution state

`src/agent-runtime/run-context.ts` describes **Agent execution context**: operation, mode, capabilities, tools, model client, and run metadata.

`src/context` describes **model context**: the bounded information selected for a specific model call.

Keeping these concepts separate avoids turning conversation history or prompt strings into the runtime source of truth.

## Deliberately not in v1

This foundation does not add:

- token estimation or tokenizer dependencies;
- automatic compaction or summarization;
- vector search, embeddings, or long-term memory;
- migration of `editing/context-selection.ts`, `editing/context-search.ts`, or `editing/project-context.ts`;
- changes to current Project Chat history limits or Edit Workflow behavior.

Those capabilities can move behind this boundary incrementally without changing the contract introduced here.
