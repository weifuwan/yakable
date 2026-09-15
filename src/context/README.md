# Context Layer

`src/context` is the model-context assembly boundary for Yakable.

It answers one question: **what should a model call know for this turn?**

It does not own persistence, project mutation, prompt wording, provider transport, or Agent workflow orchestration.

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

## Core contracts

- `ContextSnapshot` — immutable-by-contract description of the assembled model input for one turn.
- `ContextBudget` — explicit model-window and reserved-output limits; token estimation and compaction are intentionally deferred.
- `ContextProvider` — one bounded source of context such as conversation continuity, project source, plan state, runtime evidence, or tool output.
- `ContextBuilder` — normalizes the request, collects providers deterministically, and rejects ambiguous duplicate provider/section identifiers.

## Project source context

Project source context is owned by this layer:

```text
project files
    ↓
project-context-selection
    ├── mapped Visual Edit files
    ├── model-selected paths
    └── deterministic fallback
    ↓
project-context-search
    ↓
project-context
    ├── bounded readable file list
    ├── selected source snapshot
    ├── edit continuity payload
    └── resolveProjectEditContext()
```

`resolveProjectEditContext()` owns the common `LIST → SELECT → SEARCH` path used by the normal Edit workflow. Editing still owns edit intent, source mutation, checking, repair, and visual feedback.

The former `src/editing/context-selection.ts`, `src/editing/context-search.ts`, and `src/editing/project-context.ts` modules contain no implementation; they are narrow facades while the remaining Planning/Repair call sites migrate independently.

## Conversation context

Project conversation continuity also has one Context-layer policy:

```text
persisted project conversation
          ↓
conversation-context
    ├── latest 10 messages
    ├── trim blank content
    └── max 1,500 chars per message
          ↓
Project Message Router / Project Chat
```

`buildConversationContext()` does not delete or summarize old messages. SQLite remains the source of truth for the full bounded project session history; this function only chooses the recent window supplied to a model call.

Both Project Message Router and Project Chat use this same policy. Product/service code should pass available persisted conversation turns rather than applying its own `slice(...)` or per-message truncation rules.

## Context is not execution state

`src/agent-runtime/run-context.ts` describes **Agent execution context**: operation, mode, capabilities, tools, model client, and run metadata.

`src/context` describes **model context**: the bounded information selected for a specific model call.

Keeping these concepts separate avoids turning conversation history or prompt strings into the runtime source of truth.

## Still deliberately out of scope

This layer does not yet add:

- token estimation or tokenizer dependencies;
- automatic compaction or summarization;
- vector search, embeddings, or long-term memory;
- semantic retrieval over older conversation turns;
- replacement of existing byte/character limits with a shared token budget.

Those concerns remain follow-up Context work rather than being mixed into the conversation-policy migration.
