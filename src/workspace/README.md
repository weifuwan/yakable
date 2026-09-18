# Workspace runtime boundary

`WorkspaceChangeManager` is Yakable's source mutation primitive. Agent workflows express source updates as `WorkspaceChangeSet` values rather than writing files directly.

Each generated workspace also owns an internal Git baseline. Git is used as resettable diff infrastructure, not as a user-facing repository contract:

- `WorkspaceChangeSet` describes one exact mutation with before/after source.
- `TurnDiffTracker` folds every ChangeSet in one Agent Run into its final net diff.
- `readWorkspaceDiff` compares the pinned Yakable baseline with the current workspace across Agent Runs.
- `.yakable`, build output, and dependencies are excluded from the internal baseline/diff surface.

The dedicated `refs/yakable/baseline` ref stays stable even if HEAD later moves, so workspace diff semantics do not depend on user commits.
