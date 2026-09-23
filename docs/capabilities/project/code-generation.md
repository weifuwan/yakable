# Project Code Generation

Status: Designing
Domain: Project

Depends On:
- [Create Project](./create.md)
- [Model Selection](../model/selection.md)

Related:
- [Send Message](../conversation/send-message.md)
- [Stop](../conversation/stop.md)
- [Recovery](../conversation/recovery.md)

Frontend:
- No new frontend entry in V1

Backend:
- Planned: Project code generation capability
- Planned: Project file storage capability

Data:
- Project
- Project Files
- Turn
- Message

Shared Rules:
- PROJ-001
- PROJ-004
- PROJ-007

Scenarios:
- PROJ-S03

Tests:
- Planned

## Purpose

根据用户创建 Project 时输入的 Prompt，生成一个完整的项目文件集合，并写入该 Project 独立的工作目录。

V1 只打通第一次代码生成，不负责后续代码修改。

## Contract

- Initial Code Generation 复用 Project 创建时已经建立的首个 Turn，不额外创建第二个生成 Turn。
- 同一个 Initial Turn 同一时刻只能有一个有效的代码生成执行，不能因为 Project 创建和 Conversation 执行链分别触发两次模型调用。
- 代码生成使用该 Initial Turn 已固定的 Prompt、provider 和 model。
- Generation Result 包含用户可见的 Assistant 摘要和结构化项目文件集合；结构化文件数据不能直接作为 Assistant Message 展示。
- 项目文件集合必须非空；每个生成文件必须包含相对路径和完整文件内容。
- 文件路径必须为相对路径，normalize 后必须唯一，并且只能位于当前 Project Root 内。
- 文件数量、单文件内容大小和总生成内容大小必须有明确上限；任一超限时本次 Generation 失败。\n- 写文件前必须完成全部结果解析、路径校验和资源边界校验；任一校验失败时不得发布任何项目文件。
- Generation Result 必须作为完整文件集合发布；发布失败不能向 Project 暴露部分生成结果。
- Project Files 完整发布成功后，Initial Turn 才能进入 SUCCEEDED。
- Generation Success 只表示结构化结果合法且项目文件已完整发布，不代表项目已经 build 通过、可以运行或视觉质量已经验证。
- 同一个 Initial Turn 的 Retry / Recovery 必须安全且幂等；已经成功发布的项目文件不能因重复执行再次生成或被覆盖。
- 未成功发布的 Initial Turn 可以通过原 Turn Recovery 重新执行，不创建替代 Turn。
- Initial Turn 已进入 STOPPED / FAILED 后，后续迟到的模型结果不能再发布项目文件或把 Turn 改回成功。
- 代码生成失败不能删除或回滚已经创建成功的 Project。
- V1 不执行 npm install、build、preview 或自动修复。

## Flow

```text
Create Project
    ↓
Project / Session / Initial Turn / USER Message 成立
    ↓
Execute Initial Turn
    ↓
读取 Initial Turn Prompt + Provider + Model
    ↓
LLM Generate
    ↓
Parse Assistant Summary + Project Files
    ↓
Validate Complete Result
    ↓
Publish Complete Project Files
    ↓
Persist Assistant Summary
    ↓
Initial Turn → SUCCEEDED
```

Failure / Stop:

```text
Parse / Validate / Publish Failure
    ↓
Do Not Expose Partial Project Files
    ↓
Initial Turn → FAILED

Explicit Stop
    ↓
Initial Turn → STOPPED
    ↓
Reject Late File Publication
```

## Boundary

Owns:
- 第一次项目代码生成。
- Initial Turn 到 Generation Result 的业务语义。
- LLM 输出到 Assistant 摘要和项目文件的转换。
- Project 工作目录创建。
- 文件路径与资源边界校验。
- 项目文件完整发布。
- Initial Code Generation 的 Retry / Recovery 幂等边界。

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
