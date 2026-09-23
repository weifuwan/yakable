# Markdown Renderer

Status: Done
Domain: Conversation

Depends On:
- None

Related:
- [Streaming](./streaming.md)
- [History](./history.md)

Frontend:
- Current Renderer: `yakable-ui/src/shared/ui/markdown/Markdown.tsx`
- Current Consumer: `yakable-ui/src/features/session/components/MessageItem.tsx`
- Code Renderer: `@streamdown/code` configured by `yakable-ui/src/shared/ui/markdown/Markdown.tsx`
- Public Contract: `@/shared/ui`

Backend:
- None
- Message content remains `string`

Data:
- Message Content
- Markdown Source
- Fenced Code Language

Shared Rules:
- None

Scenarios:
- CONV-S01
- CONV-S02
- CONV-S04
- CONV-S07

Tests:
- `yakable-ui/src/shared/ui/markdown/__tests__/Markdown.test.tsx`
- Existing integration: `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`

## Purpose

为 Yakable 提供统一、安全、支持 Streaming 的 AI 文本渲染边界。

本 Capability 只解决：

```text
AI text
→ Markdown
→ stable text / code rendering
```

Markdown 是 Text Renderer，不是整个 Assistant Message Renderer。

未来出现 Tool / Reasoning / Artifact 时，它们在 Markdown 之上由各自 owner 渲染，不塞进 `Markdown.tsx`。

## Contract

### Ownership

Conversation Feature 只负责：

- Message role / Turn 布局。
- Streaming / History 状态。
- 将真实 Message content 交给共享 Markdown Renderer。

`shared/ui/markdown` 负责：

- Markdown parsing / rendering。
- Markdown-level block presentation。
- fenced code。
- link / raw HTML safety。
- streaming / static render mode。

Feature 禁止自己解析 Markdown AST、fenced code、language、table 或 link。

### Renderer Model

V1：

```text
MessageItem
    ↓
Markdown
    ↓
Streamdown Core
    ├── Paragraph / Heading
    ├── List / Blockquote
    ├── Table / Link
    ├── Inline Code
    └── Fenced Code
            ↓
       Code Renderer
```

Streamdown 继续作为 Markdown engine。

不新增 RendererManager / RendererFactory / BlockAssembler / RendererRegistry。

### Input And Mode

V1 不修改 Backend Message schema：

```ts
content: string
```

共享 Markdown 已增加：

```ts
mode: 'streaming' | 'static'
```

- 活动 Assistant partial → `streaming`。
- 持久化 USER / ASSISTANT History → `static`。
- mode 只控制渲染策略，不改变 Message 业务事实。

### Code Renderer

所有 fenced language 使用同一套 Renderer：

```text
java / python / javascript / typescript / html / css / json / sql / bash / ...
```

Language 是数据，不创建 `JavaCodeBlock`、`PythonCodeBlock` 之类组件。

当前使用 `@streamdown/code` + Shiki。

Code Contract：

- 展示 fenced language label。
- language alias 交给统一 code engine，不在业务组件堆 `if / switch`。
- 未知 language 退化为 plain text code，不能让整个 Message 失败。
- Copy 复制原始 code text。
- Conversation 默认只展示 Copy；Download 不出现在聊天 Code Block Surface。
- Code 只展示，不拥有 execution 语义。
- 默认不展示 line number，避免聊天回答出现 IDE 式视觉噪声。
- 默认允许横向滚动。
- 默认不创建独立纵向滚动容器；长代码参与 Conversation 正常纵向流。
- Code Block 只保留一层 Surface，背景固定使用 `#F3F3F3`；Header / Body 不再各自套 border / background。
- Header 左侧展示轻量 Code 标识 + language，右侧只保留 Copy。
- Code controls 必须有 accessible name。

### Streaming

Streaming Markdown 必须容忍：

- 未闭合 emphasis。
- 未闭合 fenced code。
- 未完成 list / table。

要求：

- partial content 不因语法未完成而整段消失。
- Feature 不手写 token-by-token Markdown parser。
- Streaming 与最终静态 Message 使用同一 Markdown 语义。
- Plugin 配置不能在每个 token render 时重复创建昂贵实例。
- Heavy Renderer 不得因为每个 token 做无界高成本工作。

V1 只承诺 Markdown + Code。

Mermaid / Math 真正实现前必须单独验证 Streaming 成本与 incomplete block 行为。

### Safety

LLM Markdown 是不可信输入。

必须保证：

- 不执行 script。
- 不把 raw HTML 当作可信应用代码执行。
- URL 继续经过安全转换 / link safety。
- Code Block 永远只展示文本。
- Feature 不用 `dangerouslySetInnerHTML` 绕过共享 Renderer。

### Performance And Accessibility

- `Markdown` 可以继续 memoized。
- History Heavy DOM 继续由 Turn Windowing 管理；Markdown 不实现第二套 virtualization。
- Optional plugin 按真实需求引入，不一次加载未来能力。
- heading / list / table / link 保留原生语义。
- Copy / Download 使用可键盘操作的 button。

## Flow

当前：

```text
Session Message
→ MessageItem
→ Markdown(content)
→ Streamdown
→ DOM
```

V1 目标：

```text
Session Message
→ MessageItem
→ Markdown(content, mode)
→ Streamdown Core
    ├── normal Markdown
    └── fenced code
         ↓
      @streamdown/code
         ↓
      Code Renderer
```

Streaming：

```text
Assistant delta
→ partial content
→ Markdown(streaming)

Turn terminal / History
→ persisted content
→ Markdown(static)
```

## Acceptance

Review evidence：

- 已知 language 通过同一个 `@streamdown/code` + Shiki Renderer 处理。
- unknown / streaming 中被截断的 language identifier 退化为可读 plain code，不让 Message 失败。
- 未闭合 fenced code 在 `streaming` mode 下继续可见，Code actions 保持 disabled。
- static code 的 Copy 保持可用，Copy 复制 fenced code 原始文本；Conversation 默认隐藏 Download。
- raw HTML 继续经过 Streamdown 默认 sanitize / harden 边界；script、event handler 与危险 URL 不进入可执行 DOM。
- fenced HTML / script source 只作为 code text 展示，不执行。
- `markdownPlugins` 保持 module-level stable reference，不随每个 token render 重建 plugin 配置。
- `@streamdown/code` 按需 lazy-load language grammar；Markdown 不引入第二套 history virtualization。
- Code Block 关闭默认纵向 max-height，Conversation 保持单一纵向滚动 owner。
- Markdown / Code controls 保留原生语义与可访问名称；Code Surface 使用单层 `#F3F3F3` 背景、无 line number。
- Backend Message schema、Streaming transport、History Window、Turn Windowing 均无变化。

Acceptance Review 已闭环：

- unknown language、incomplete streaming fence、raw HTML / dangerous URL、fenced script source 都已有回归保护。
- `streaming / static`、Code controls、Shiki lazy language、module-level plugin config 与 Turn Windowing ownership 已完成 Review。
- Review Commit `9caf87e0358281edff020a5f2fb43fc0bc4f88e9` 已通过 Frontend Verification、Backend Verification 与 `Yakable / Quality Gate`。
- Code Surface Visual Polish 已闭环：单层 `#F3F3F3` Surface、隐藏 Download、关闭 line number、Header 使用轻量 Code 标识。
- Review Commit `96efa13565e7c9916e33c79ae0a7349514e6c789` 已通过 Frontend Verification、Backend Verification 与 `Yakable / Quality Gate`。
- Known Gaps = none。
- 最终 `Status: Done` Commit 本身仍需再次通过完整 Quality Gate。

## Boundary

Owns:
- AI-generated Markdown text rendering
- fenced Code rendering
- Markdown safety boundary
- streaming / static Markdown mode

Does Not Own:
- Message role / alignment
- Message copy / timestamp actions
- Turn layout
- Streaming transport
- Tool / Reasoning / Artifact UI
- Code execution
- generated file workspace
- Message persistence schema
- Mermaid / Math V1 rendering

## Delivery

```text
PR1 — Markdown Renderer Capability Design

PR2 — Code Renderer
→ @streamdown/code + Shiki
→ generic language handling
→ copy / download
→ remove nested vertical code scrolling
→ regression tests

PR3 — Markdown Renderer Acceptance
→ streaming / static behavior
→ safety regression
→ performance review
→ Status: Done
```

Mermaid / Math 不进入本轮 Delivery。
