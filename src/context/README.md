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
- `ContextBudget` — explicit context-window and reserved-output limits plus usage measurement/assertion.
- `ContextProvider` — one bounded source of context such as conversation continuity, project source, plan state, runtime evidence, or tool output.
- `ContextBuilder` — normalizes the request, collects providers deterministically, and rejects ambiguous duplicate provider/section identifiers.
- `token-estimator` — dependency-free conservative token estimation used for Yakable-side budgeting. It is intentionally replaceable by a provider tokenizer later.
- `model-request-budget` — the final end-to-end safety gate that measures every model-visible message plus reserved output immediately before transport.

## End-to-end model request budget

Context sub-systems may own smaller local budgets, but a local budget cannot prove that the final provider request fits. System prompts, current user input, compacted history, recent messages, source context, and any other model-visible messages all contribute to the real request.

Yakable therefore enforces one final invariant immediately before a model request is sent:

```text
system prompt
+ current task / user input
+ recent conversation
+ compacted history
+ project / plan / runtime context
+ chat message overhead
+ reserved output tokens
                    ↓
        configured request envelope
                    ↓
            send only if it fits
```

`assertModelRequestWithinBudget()` measures the complete message list with the shared conservative estimator and applies `ContextBudget` using the request's actual output reservation. The current DeepSeek transport exposes `DEEPSEEK_CONTEXT_WINDOW_TOKENS` as the Yakable-side request envelope; `DEEPSEEK_MAX_TOKENS` must be smaller than that envelope.

All structured DeepSeek generations pass through this gate in `deepSeekModelClient`. Project Chat and Project Message Router currently call the provider transport directly, so they apply the same gate before their HTTP request. This keeps the invariant at the last responsible moment instead of relying on upstream assumptions such as a fixed non-history reserve.

The configured context-window value is a Yakable safety configuration, not a provider capability claim. It should match or stay below the selected model's actual supported context window.

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
    ├── token-bounded edit continuity
    └── resolveProjectEditContext()
```

`resolveProjectEditContext()` owns the common `LIST → SELECT → SEARCH` path used by the normal Edit workflow. Editing still owns edit intent, source mutation, checking, repair, and visual feedback.

The former `src/editing/context-selection.ts`, `src/editing/context-search.ts`, and `src/editing/project-context.ts` modules contain no implementation; they are narrow facades while the remaining Planning/Repair call sites migrate independently.

Edit continuity no longer grows from a fixed `recentEdits.slice(...)`. Persisted edit requests/summaries are converted into the same bounded conversation representation used by chat: recent role-preserving messages plus compacted older history. Current source files remain the source of truth for what already exists.

## Conversation context

Persistence and model context are deliberately separate:

```text
SQLite project conversation (full retained history)
                    ↓
            conversation-context
          ┌─────────┴──────────┐
          ↓                    ↓
 recent role-preserving   compacted older
      messages               history
          └─────────┬──────────┘
                    ↓
             token budget
                    ↓
      Project Message Router / Chat
```

Current v2 policy:

- consider at most 10 recent persisted messages as the high-fidelity window;
- cap an individual recent message at 1,500 characters before token budgeting;
- keep recent history within 4,500 estimated tokens;
- compact older history into at most 1,500 estimated tokens;
- keep total conversation history within 6,000 estimated tokens;
- reserve an additional 2,000 input tokens inside the Conversation Context budget for non-history task/system input;
- reserve 4,000 tokens for output in the conservative 12,000-token conversation budget envelope.

The Conversation Context envelope is a local sub-budget. The final model request is still measured end-to-end before transport, so a large current user input or system prompt cannot silently exceed the configured provider request envelope.

The estimator is intentionally conservative and provider-independent: ASCII is approximated at four characters/token, CJK-like text at one code point/token, and other Unicode at two code points/token. This is a Yakable safety budget, not a claim about the exact tokenizer of any provider model.

Older turns remain persisted in SQLite. Context compaction changes only what enters one model call; it does not delete conversation history. Project session persistence no longer drops edits after the previous 40-edit retention boundary.

Both Project Message Router and Project Chat consume the same `recentConversation + compactedHistory` representation. Product/service code should pass available persisted turns rather than applying its own `slice(...)` or truncation rules.

## Context is not execution state

`src/agent-runtime/run-context.ts` describes **Agent execution context**: operation, mode, capabilities, tools, model client, and run metadata.

`src/context` describes **model context**: the bounded information selected for a specific model call.

Keeping these concepts separate avoids turning conversation history or prompt strings into the runtime source of truth.

## Still deliberately out of scope

This layer does not yet add:

- provider-specific tokenizer dependencies;
- model-generated semantic summaries of old turns;
- semantic retrieval over older conversation history;
- vector search, embeddings, or long-term memory;
- token-aware shrinking of selected source-file contents (the existing project snapshot byte safety limit still applies).

Those are later Context capabilities. The current compaction path is deterministic so Context growth is bounded without adding another model call or making persistence lossy.
