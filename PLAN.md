# Yakable Capability Roadmap

> One capability, one problem, one verifiable outcome.

## Working now

- **Build Intent Gate:** route dashboard input into CREATE, CHAT, or CLARIFY before project generation so casual or ambiguous input does not create a project. ✅
- **Prompt Intelligence:** parse user intent, fill conservative semantic defaults, translate vague taste language, and compile the result into a versioned Design Intent IR. ✅
- **Project Generation:** turn a product request plus Design Intent into a complete frontend source tree. ✅
- **Runtime & Preview:** run generated projects in a controlled local Vite runtime and expose a live Preview. ✅
- **Project Editing:** apply follow-up requests as focused source changes without regenerating the whole project. ✅
- **Persistent Edit Context:** preserve the original product request, Design Intent, and recent successful manual edits so later user-directed changes keep project continuity across API/runtime sessions. ✅
- **Persistent Conversation:** store project conversation turns, timestamps, changed files, and Visual Edit targets in local SQLite so the workspace can restore them after reload. ✅
- **Visual → Source Editing:** select Preview elements, map them back to JSX source locations, and use that context for targeted edits. ✅
- **Project Workspace:** reopen, switch, rename, star, remix, and delete generated projects from the dashboard. ✅
- **Yakable Base Template:** copy a neutral, versioned React + Vite + Tailwind foundation with explicit Yakable-owned and project-owned file boundaries, without invoking a model. ✅
- **Capability Packs:** explicitly install optional UI capabilities on top of Base, with pack-owned files, deterministic dependency merging, conflict protection, idempotent installs, and persisted capability state. ✅
- **Minimal Tool Contract:** expose structured Tool / ToolResult / ToolRegistry primitives and route project text reads through a safe `read_project_file` tool, without model tool-calling or MCP. ✅
- **Project Context Selection:** list safe text-file paths first, select at most 12 relevant files from the request or Visual Edit mapping, then read only those files for Project Edit. Existing files outside selected context cannot be modified. ✅
- **Project Search Tool:** when file paths alone are ambiguous, allow Context Selection to request exactly one bounded literal `search_project` query, merge matched files into context, then continue through `read_project_file`. ✅
- **Project Check Tool:** after each source edit, run bounded TypeScript and Vite build checks and return structured PASS/FAIL diagnostics without modifying the project. ✅
- **One-shot Repair:** when the post-edit check reports FAIL, build a bounded repair context, allow exactly one targeted repair patch, run one final project check, then stop whether it passes or fails. ✅
- **Page Observation v0:** let the live Preview return one bounded source-mapped snapshot containing route, viewport/document dimensions, visible key elements, and captured runtime errors, without screenshotting, model judgment, or source mutation. ✅

## Next

- **Edit Intent Delta v0:** normalize a follow-up edit request into a small explicit frontend-change contract that preserves the original Design Intent and can be reused by Context Selection, editing, and future critique.

## Later

- **Design Critic v0:** inspect Page Observation against Design Intent and the current edit intent, returning bounded structured PASS/FAIL findings without modifying source.
- **Visual Repair v0:** when Design Critic reports FAIL, allow one bounded visual repair, re-check project health, observe once more, critique once more, then stop.
- **Frontend Agent v0:** expose the bounded frontend workflow as explicit states such as SELECT_CONTEXT → READ → EDIT → CHECK → OBSERVE → CRITIQUE → REPAIR → DONE before considering broad model-selected tool calling.
- **UI Planner v0:** compile Design Intent into a small explicit page/section/hierarchy/responsive plan before code generation, without introducing a broad layout DSL.
- **Taste Library & Retrieval:** retrieve focused frontend patterns and examples only when they are relevant to the current design decision.
- **MCP Adapter:** expose external MCP tools through the same internal Tool contract after local tool execution is stable.
- **Model Prompt Compiler:** compile Yakable's model-independent IR into model-specific generation instructions when multiple model providers make that abstraction necessary.
- **Long-running Iteration Robustness:** improve compaction, conflict handling, and preservation of unrelated code when edit histories become large.
- **Versioning & Rollback:** capture stable project versions, inspect diffs, and restore earlier states safely.
- **Full-stack Capabilities:** add product-facing database, auth, storage, secrets, and backend functions without exposing unnecessary complexity.
- **Deployment & Collaboration:** add deployment, GitHub sync, collaboration, model routing, ownership, and production infrastructure as real usage demands them.
