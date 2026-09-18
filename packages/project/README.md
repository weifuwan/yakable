# Project

Project sits above Workspace.

A Project owns identity and metadata, including the `workspaceId` that points to its working directory.

Current responsibilities:

- create a project
- persist project metadata
- load a project
- create and resolve the project's workspace

Current relationship:

```text
Project
├── id
├── name
└── workspaceId
        ↓
    Workspace
```
