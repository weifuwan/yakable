# Project Code Generation

Status: Designing
Domain: Project

Depends On:
- [Create Project](./create.md)
- [Model Selection](../model/selection.md)

Related:
- [Send Message](../conversation/send-message.md)

Frontend:
- No new frontend entry in V1

Backend:
- Planned: Project code generation capability
- Planned: Project file storage capability

Data:
- Project
- Project Files

Shared Rules:
- PROJ-001
- PROJ-004

Scenarios:
- PROJ-S03

Tests:
- Planned

## Purpose

根据用户创建 Project 时输入的 Prompt，生成一个完整的项目文件集合，并写入该 Project 独立的工作目录。

V1 只打通第一次代码生成，不负责后续代码修改。

## Contract

- 每个 Project 拥有独立的项目目录。
- 代码生成使用 Project 创建时的 Prompt 和已选择模型。
- LLM 必须返回结构化的项目文件集合，而不是仅返回 Markdown 代码块。
- 每个生成文件包含相对路径和完整文件内容。
- 所有文件必须位于当前 Project 目录内。
- 写文件前必须校验全部文件路径。
- 任意文件路径非法时，本次生成不得写入 Project 目录。
- 生成成功后，文件必须真实存在于 Project 目录。
- 代码生成失败不能删除或回滚已经创建成功的 Project。
- V1 不执行 npm install、build、preview 或自动修复。

## Flow

```text
Create Project
    ↓
Project / Session / Turn / USER Message 成立
    ↓
读取初始 Prompt + Model
    ↓
LLM Generate Project Files
    ↓
Parse Generated Files
    ↓
Validate All File Paths
    ↓
Create Project Directory
    ↓
Write Files
    ↓
Generation Complete
```

## Boundary

Owns:
- 第一次项目代码生成。
- LLM 输出到项目文件的转换。
- Project 工作目录创建。
- 文件路径安全校验。
- 项目文件写入。

Does Not Own:
- 后续 Prompt 修改已有代码。
- 文件 Diff / Patch。
- Spec。
- ChangeSet。
- Template。
- Agent / Tool。
- Shell Command。
- npm install。
- Build / Preview。
- 自动修复。
- Git。
