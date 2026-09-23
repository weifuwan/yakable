# Markdown Renderer

Status: Implementing
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

Known Gaps:
- Code Renderer 已进入实现：`@streamdown/code` + Shiki 已接入。
- `Markdown` 已显式支持 `streaming / static` mode，Streaming Assistant 已接线。
- Code Block 已关闭 Streamdown 默认纵向 max-height，保留 Conversation 单一纵向滚动。
- PR3 仍需完成 unknown language / safety / performance Acceptance。
- Mermaid / Math / Tool / Reasoning / Artifact 不属于当前实现。

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
- Download 只导出原始文本，不执行代码。
- Code 只展示，不拥有 execution 语义。
- 默认允许横向滚动。
- 默认不创建独立纵向滚动容器；长代码参与 Conversation 正常纵向流。
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
