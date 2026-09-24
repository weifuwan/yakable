# Project Files Browse

Status: Designing
Domain: Project

Depends On:
- [Project Code Generation](./code-generation.md)

Related:
- [Create Project](./create.md)
- [Recent Projects](./recent-projects.md)

Frontend:
- `yakable-ui/src/pages/project/index.tsx`
- `yakable-ui/src/features/project/components/ProjectFilesTree.tsx` (planned)
- `yakable-ui/src/features/project/components/ProjectFileViewer.tsx` (planned)
- `yakable-ui/src/service/project/ProjectService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/project/ProjectController.java`
- `yakable-service/src/main/java/io/yakable/service/project/ProjectService.java`
- `yakable-service/src/main/java/io/yakable/service/project/impl/ProjectServiceImpl.java`
- `yakable-core/src/main/java/io/yakable/core/project/files/ProjectFiles.java`
- `yakable-core/src/main/java/io/yakable/core/project/files/ProjectFile.java`

Data:
- Project
- Published Project Files

Shared Rules:
- PROJ-001
- PROJ-007

Scenarios:
- PROJ-S04

Tests:
- `yakable-ui/src/features/project/components/__tests__/ProjectFilesTree.test.tsx` (planned)
- `yakable-ui/src/features/project/components/__tests__/ProjectFileViewer.test.tsx` (planned)
- `yakable-boot/src/test/java/io/yakable/boot/controller/project/ProjectControllerTest.java` (planned extension)
- `yakable-service/src/test/java/io/yakable/service/project/impl/ProjectServiceImplTest.java` (planned extension)
- `yakable-core/src/test/java/io/yakable/core/project/files/ProjectFilesTest.java` (planned extension)

## Purpose

让用户在 Initial Code Generation 完成后，可以看到当前 Project 已经正式发布了哪些文件，并查看任意文本文件的完整内容。

V1 只解决“生成了什么”这个问题。

它是 Project Files 的只读浏览入口，不是代码编辑器，也不负责判断项目能否构建或运行。

## Contract

- Project Files Browse 只能读取当前用户有权限访问的 Project。
- 用户文件查询必须先完成 Project ownership 校验，再进入文件读取能力；Project ID 或文件路径本身不能作为访问授权。
- Browse 只能暴露已经完整发布的 Project Root；`.yakable-staging`、`.yakable`、临时文件和未完成的 Generation Result 都不能对用户可见。
- Controller / Service 不直接扫描或读取工作目录；文件枚举、路径解析和内容读取统一通过 `ProjectFiles` 能力完成。
- 文件列表只返回相对于 Project Root 的规范化路径，不暴露服务器绝对路径。
- 文件树由已发布文件的相对路径稳定构建；目录节点只是展示结构，不要求作为独立 Project File 保存。
- 同一个规范化文件路径在一次浏览结果中只能出现一次。
- 文件内容读取必须重新执行 Project Root 边界校验；绝对路径、`..`、符号链接逃逸或任何 Project Root 外访问都必须拒绝。
- Project 尚未完成首次文件发布时，Browse 返回明确的空结果；不能通过扫描 staging 或其他目录推断“部分生成结果”。
- Initial Code Generation 完整发布成功后，页面刷新、重新进入 Project 或切换 Session 都可以重新加载相同的已发布文件集合。
- V1 支持查看文本文件完整内容和基础代码高亮，不承诺二进制文件预览。
- 单个文件读取失败只影响当前文件展示，不能改变其他文件或 Project 状态。
- Browse 是纯只读能力，不得创建、修改、删除、重命名或覆盖任何 Project File。
- Browse Success 只表示文件可以安全读取，不表示代码 build 通过、可以运行或视觉效果正确。

## Flow

```text
Open Project Detail
    ↓
Load Project Files
    ↓
Validate Project Ownership
    ↓
ProjectFiles.listPublished(projectId)
    ↓
Build File Tree
    ↓
Select File
    ↓
ProjectFiles.readPublished(projectId, relativePath)
    ↓
Render File Content
```

尚未发布文件时：

```text
Open Project Detail
    ↓
No Published Project Root
    ↓
Show Empty State
```

禁止：

```text
Controller / Service
    ↓
Files.walk / Files.readString
    ↓
Project Work Directory
```

## Boundary

Owns:
- 当前 Project 已发布文件列表查询。
- 已发布文件到前端文件树的稳定映射。
- 单个文本文件完整内容读取。
- Project ownership 与文件读取边界的衔接。
- Project Root 内的安全路径解析。
- 页面刷新后的文件浏览恢复。
- Project Files 的只读前端展示。

Does Not Own:
- Initial Code Generation。
- 后续 Prompt 修改已有代码。
- 文件创建、编辑、删除或重命名。
- Diff / Patch / ChangeSet。
- Spec / Template。
- File Search / Find / Replace。
- 多文件 Tab 或 IDE 工作台。
- Shell / Terminal。
- npm install。
- Build / Preview。
- 自动修复。
- Git。
- Agent / Tool。
- 二进制文件预览。
