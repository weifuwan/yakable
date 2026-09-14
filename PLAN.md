# Yakable Capability Roadmap

> One capability, one problem, one verifiable outcome.

## Working now

- **Prompt Intelligence:** parse user intent, fill conservative semantic defaults, translate vague taste language, and compile the result into a versioned Design Intent IR. ✅
- **Project Generation:** turn a product request plus Design Intent into a complete frontend source tree. ✅
- **Runtime & Preview:** run generated projects in a controlled local Vite runtime and expose a live Preview. ✅
- **Project Editing:** apply follow-up requests as focused source changes without regenerating the whole project. ✅
- **Persistent Edit Context:** preserve the original product request, Design Intent, and recent successful manual edits so later user-directed changes keep project continuity across API/runtime sessions. ✅
- **Visual → Source Editing:** select Preview elements, map them back to JSX source locations, and use that context for targeted edits. ✅
- **Project Workspace:** reopen, switch, rename, star, remix, and delete generated projects from the dashboard. ✅

## Next

- **UI Planner:** compile Design Intent into an explicit page, section, hierarchy, and responsive-layout plan before code generation.
- **Model Prompt Compiler:** compile Yakable's model-independent IR into model-specific generation instructions.
- **Design Critic:** inspect generated UI against Design Intent and UI Plan instead of relying only on the generator's self-judgment.
- **Repair Loop:** feed bounded build, runtime, and design failures back into targeted repair until the project is healthy or the retry limit is reached.

## Later

- **Long-running Iteration Robustness:** improve compaction, conflict handling, and preservation of unrelated code when edit histories become large.
- **Versioning & Rollback:** capture stable project versions, inspect diffs, and restore earlier states safely.
- **Full-stack Capabilities:** add database, auth, storage, secrets, and backend functions without exposing unnecessary complexity.
- **Deployment & Collaboration:** add deployment, GitHub sync, collaboration, model routing, ownership, and production infrastructure as real usage demands them.
