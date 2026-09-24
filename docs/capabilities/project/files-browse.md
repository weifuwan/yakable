# Project Files Browse

Status: Review
Domain: Project

Depends On:
- [Project Code Generation](./code-generation.md)

Related:
- [Create Project](./create.md)
- [Recent Projects](./recent-projects.md)

Frontend:
- `yakable-ui/src/pages/project/index.tsx`
- `yakable-ui/src/features/project/components/ProjectFilesBrowser.tsx`
- `yakable-ui/src/features/project/components/ProjectFilesTree.tsx`
- `yakable-ui/src/features/project/components/ProjectFileViewer.tsx`
- `yakable-ui/src/service/project/ProjectService.ts`
- `yakable-ui/src/service/project/types.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/project/ProjectController.java`
- `yakable-service/src/main/java/io/yakable/service/project/ProjectService.java`
- `yakable-service/src/main/java/io/yakable/service/project/impl/ProjectServiceImpl.java`
- `yakable-core/src/main/java/io/yakable/core/project/files/ProjectFiles.java`
- `yakable-core/src/main/java/io/yakable/core/project/files/ProjectFile.java`
- `yakable-common/src/main/java/io/yakable/common/bean/dto/project/QueryProjectFilesDTO.java`
- `yakable-common/src/main/java/io/yakable/common/bean/dto/project/QueryProjectFileDTO.java`
- `yakable-common/src/main/java/io/yakable/common/bean/vo/project/ProjectFilesVO.java`
- `yakable-common/src/main/java/io/yakable/common/bean/vo/project/ProjectFileVO.java`

Data:
- Project
- Published Project Files

Shared Rules:
- PROJ-001
- PROJ-007

Scenarios:
- PROJ-S04

Tests:
- `yakable-ui/src/features/project/components/__tests__/ProjectFilesBrowser.test.tsx`
- `yakable-ui/src/features/project/components/__tests__/ProjectFilesTree.test.tsx`
- `yakable-ui/src/features/project/components/__tests__/ProjectFileViewer.test.tsx`
- `yakable-ui/src/pages/project/__tests__/ProjectPage.test.tsx`
- `yakable-ui/src/service/project/__tests__/ProjectService.test.ts`
- `yakable-boot/src/test/java/io/yakable/boot/controller/project/ProjectControllerTest.java`
- `yakable-service/src/test/java/io/yakable/service/project/impl/ProjectServiceImplTest.java`
- `yakable-core/src/test/java/io/yakable/core/project/files/ProjectFilesTest.java`

Review Notes:
- PR1 已完成 Project Files Read Core：publication 可见性、路径隔离、metadata / Symbolic Link 隔离和按需读取由 `ProjectFiles` 统一负责。
- PR2 已完成 Project Files API：文件列表与文件内容查询分别执行 Project ownership 校验，Controller / Service 不直接访问工作目录。
- PR3 已完成 Project Files Browse UI：页面只先加载文件路径，用户选择文件后才加载完整内容；Browse 不解释 Generation / Turn 状态。
- 2026-09-24 Acceptance Review 发现一个端到端 Blocker：Create Project 成功后会立即进入 Project 页面，而 Initial Code Generation 异步执行；如果 Browse 在 publication 前首次得到空列表，当前页面不会在 publication 后重新加载，用户必须手动刷新或重新进入 Project 才能看到文件。

## Purpose

让用户在 Initial Code Generation 完成后，可以看到当前 Project 已经正式发布了哪些文件，并查看任意文本文件的完整内容。

V1 只解决“生成了什么”这个问题。

它是 Project Files 的只读浏览入口，不是代码编辑器，也不负责判断项目能否构建或运行。

## Contract

- Project Files Browse 只能读取当前用户有权限访问的 Project。
- 文件列表查询和单文件内容查询是两个独立的授权边界；每一次请求都必须重新校验当前用户对 Project 的 ownership，不能依赖此前已经成功执行过的 Browse 请求。
- Project ID 或文件路径本身不能作为访问授权。
- Browse 只能暴露已经完整发布的 Project Files；Project Root 存在本身不代表已经发布，必须由 `ProjectFiles` 确认有效 publication metadata 后才能进入可浏览状态。
- `.yakable-staging`、`.yakable`、publication metadata、临时文件和未完成的 Generation Result 都属于内部数据，不能对用户可见。
- Controller / Service 不直接扫描或读取工作目录；文件枚举、publication 判断、路径解析和内容读取统一通过 `ProjectFiles` 能力完成。
- 文件列表只返回相对于 Project Root 的规范化文件路径以及浏览所需的最小信息，不返回所有文件完整内容。
- 文件内容只在用户选择具体文件后按需读取，不能因为打开 Project 就一次性加载完整项目内容。
- 文件树由已发布文件的相对路径稳定构建；目录节点只是展示结构，不要求作为独立 Project File 保存。
- 同一个规范化文件路径在一次浏览结果中只能出现一次。
- 文件枚举和文件内容读取都不得跟随 Symbolic Link；Symbolic Link 不属于 V1 可浏览 Project File，也不能借此访问 Project Root 之外的内容。
- 文件内容读取必须重新执行 Project Root 边界校验；绝对路径、`..` 或任何 Project Root 外访问都必须拒绝。
- Project 尚未形成有效 publication 时，Browse 返回明确的空结果；不能通过扫描 Project Root、staging 或其他目录推断部分生成结果。
- 当 Project 页面在首次 publication 前已经打开并显示空结果时，publication 完成后必须能够在不要求用户手动刷新整个页面的情况下重新加载 Published Project Files。
- Publication 后的重新加载触发机制不能让 Browse 自己推导或返回 Generation / Turn 状态；前端如需区分 RUNNING / FAILED / STOPPED，继续使用已有 Turn 状态。
- Initial Code Generation 完整发布成功后，页面刷新、重新进入 Project 或切换 Session 都可以重新加载相同的已发布文件集合。
- V1 支持查看文本文件完整内容和基础代码高亮，不承诺二进制文件预览。
- 单个文件读取失败只影响当前文件展示，不能改变其他文件或 Project 状态。
- Browse 是纯只读能力，不得创建、修改、删除、重命名或覆盖任何 Project File。
- Browse Success 只表示文件可以安全读取，不表示代码 build 通过、可以运行或视觉效果正确。

## Flow

文件列表：

```text
Open Project Detail
    ↓
List Project Files Request
    ↓
Validate Project Ownership
    ↓
ProjectFiles Validate Publication
    ↓
ProjectFiles.listPublished(projectId)
    ↓
Return Relative File Paths
    ↓
Build File Tree
```

文件内容：

```text
Select File
    ↓
Read Project File Request
    ↓
Validate Project Ownership
    ↓
ProjectFiles Validate Publication
    ↓
ProjectFiles.readPublished(projectId, relativePath)
    ↓
Render File Content
```

尚未发布文件时：

```text
Open Project Detail
    ↓
No Valid Publication
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
- 单个文本文件完整内容按需读取。
- Project ownership 与文件读取边界的衔接。
- Publication 可见性判断。
- Project Root 内的安全路径解析。
- Symbolic Link 与内部 metadata 隔离。
- 页面刷新后的文件浏览恢复。
- Project Files 的只读前端展示。

Does Not Own:
- Initial Code Generation。
- Generation / Turn 状态解释。
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

## Acceptance Review

Date: 2026-09-24

Result: Blocked

Passed:
- 已发布文件必须由有效 publication metadata 决定，Project Root 存在本身不能绕过 publication。
- `.yakable`、`.yakable-staging`、内部 metadata、Symbolic Link 和未发布结果不会进入 Browse。
- 文件列表与单文件内容查询分别执行 Project ownership 校验。
- 文件列表只返回相对路径，完整文件内容按用户选择单独加载。
- 路径 normalize、绝对路径、parent traversal、Symbolic Link 和资源边界已有 Core Test 保护。
- File Tree 可以从相对路径恢复目录层级，并使用完整相对路径选择文件。
- File Viewer 为只读展示，并复用现有 Markdown / Code renderer 提供基础代码高亮。
- 未发布时 UI 使用中性空态，不推导 RUNNING / FAILED / STOPPED。
- 单文件读取错误只落在 File Viewer 边界，不改变 Project Files 或 Turn 状态。
- PR1 / PR2 / PR3 的最终 CI 均通过 Backend Verification、Frontend Verification 和 Yakable Quality Gate。

Blocker:
- Create Project 返回后会立即导航到 Project 页面，但 Initial Code Generation 在事务提交后异步执行。
- `ProjectFilesBrowser` 当前只在挂载时查询一次文件列表。
- 如果第一次查询发生在 publication 之前，UI 会进入 `No published files yet.`，后续 publication 成功不会触发重新查询。
- 因此正常 Create → Initial Code Generation → Files Browse 流程仍依赖用户手动刷新或重新进入 Project，V1 端到端闭环尚未成立。

Exit Criteria:
- publication 在页面已打开后完成时，Project Files Browser 可以自动重新加载已发布文件。
- Browse 本身仍不拥有或推导 Generation / Turn 状态。
- 增加前端回归测试，证明“首次空列表 → publication 完成 → 文件树出现”不需要整页手动刷新。
- 增加前端回归测试，证明单文件读取失败后仍可选择并成功读取其他文件。
- 完整 CI 通过后，Status 才能从 `Review` 更新为 `Done`。
