# Workspace mutation boundary

`WorkspaceChangeManager` is Yakable's source mutation primitive.

Agent workflows must express source updates as a `WorkspaceChangeSet` rather than writing files directly. A change set captures the before/after state for every file, supports add/modify/delete semantics, and can be rolled back with conflict detection.

The next architecture step can add Git baseline and turn diff on top of this boundary without changing Create/Edit/Repair workflows again.
