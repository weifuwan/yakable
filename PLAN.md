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

## Next

- **UI Planner:** compile Design Intent into an explicit page, section, hierarchy, and responsive-layout plan before code generation.
- **Model Prompt Compiler:** compile Yakable's model-independent IR into model-specific generation instructions.
- **Design Critic:** inspect generated UI against Design Intent and UI Plan instead of relying only on the generator's self-judgment.
- **Repair Loop:** feed bounded build, runtime, and design failures back into targeted repair until the project is healthy or the retry limit is reached.

## Later

- **Long-running Iteration Robustness:** improve compaction, conflict handling, and preservation of unrelated code when edit histories become large.
- **Versioning & Rollback:** capture stable project versions, inspect diffs, and restore earlier states safely.
- **Full-stack Capabilities:** add product-facing database, auth, storage, secrets, and backend functions without exposing unnecessary complexity.
- **Deployment & Collaboration:** add deployment, GitHub sync, collaboration, model routing, ownership, and production infrastructure as real usage demands them.
