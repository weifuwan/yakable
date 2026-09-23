# Turn Navigator Interaction V2

Status: Done
Domain: Conversation

Depends On:
- [Turn Navigator](./turn-navigator.md)

Related:
- [History](./history.md)
- [Streaming](./streaming.md)

Frontend:
- Surface: `yakable-ui/src/features/session/components/turn-navigator/TurnNavigator.tsx`
- Interaction: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigatorInteraction.ts`
- Reuse Navigation Runtime: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigator.ts`
- Reuse Conversation Geometry: `yakable-ui/src/features/session/components/turn-navigator/turn-navigation.ts`
- Existing Host: `yakable-ui/src/features/session/components/SessionWorkspace.tsx`

Backend:
- Reuse: `GET /api/projects/{projectId}/sessions/{sessionId}/turns/navigation`
- Reuse: `GET /api/projects/{projectId}/sessions/{sessionId}/messages/window?anchorSequence={sequence}`
- No backend contract change planned

Data:
- Turn
- USER Message Preview
- Message Window

Shared Rules:
- CONV-014

Scenarios:
- CONV-S06

Tests:
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/TurnNavigator.test.tsx`
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/useTurnNavigator.test.tsx`
- Existing: `yakable-ui/src/features/session/components/turn-navigator/__tests__/turn-navigation.test.ts`
- Existing: `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`

## Purpose

保留 Turn Navigator V1 已经稳定的导航能力，只重做交互表面。

目标不是增加更多导航功能，而是让 Navigator 默认更轻，需要时再展开完整 Prompt 上下文。

核心方向：

```text
能力不减
默认信息更少
需要时再展开
```

## Contract

### Surface

Navigator 使用两态交互：

```text
Collapsed
→ Compact Rail

Hover / Focus
→ Prompt Overview
```

Collapsed 默认态：

- 不再显示外层白色胶囊。
- 不再常驻边框、阴影和背景面板。
- 不再常驻 Previous / Next 箭头。
- 不再常驻 Origin / Terminus 圆点。
- 只显示少量横线表达当前位置和可导航性。
- Current 横线更深、更宽。
- Navigator 不改变 Conversation 内容宽度，不进入正常文档流。
- 窄屏继续隐藏 Navigator。

Compact Rail 最多显示 5 个邻近 Turn 的视觉位置：

```text
previous 2
previous 1
current
next 1
next 2
```

靠近 Session 起点或终点时窗口自然偏移。

Compact Rail 不是完整 Session Map，不需要把所有 Turn 同时画成 Rib。

### Prompt Overview

Pointer 进入 Compact Rail，或 Keyboard Focus 进入 Navigator 时，向左展开 Prompt Overview。

Overview：

- 直接复用 Navigation Index 的 `preview`。
- 每个正式 Turn 对应一行 USER Prompt。
- 按 USER Message Sequence 升序。
- Current Turn 使用弱背景高亮。
- Prompt 单行截断。
- 不渲染 Markdown。
- Panel 高度受 viewport 限制，超出后内部滚动。
- Panel 是浮层，不改变 Conversation scroll geometry。
- Navigator 关闭时不常驻完整 Prompt List DOM。

打开 Overview 时必须保证 Current Prompt Row 可见。

用户主动滚动、Pointer 操作或 Keyboard Focus 移动 Overview 后：

- Current 仍可继续更新。
- Overview 暂停自动跟随 Current。
- 不得把用户正在操作的 Row 从指针或 Focus 下移走。

### Pointer Interaction

Compact Rail 与 Prompt Overview 属于同一个 Interaction Surface。

从 Rail 移向 Overview 时不能因为跨越间隙立即关闭。

关闭条件：

```text
Pointer 已离开整个 Interaction Surface
AND
Focus 也不在 Interaction Surface
→ close
```

允许使用很短的 grace period 避免 Rail → Panel 闪退，但 grace period 不承担复杂动画语义。

点击 Prompt Row：

```text
Prompt Row
→ existing jumpToTurn(item)
→ target already loaded?
   ├─ yes → align
   └─ no  → load Target Message Window
          → align
```

Jump pending 时 Overview 继续可交互。

用户选择新目标时继续使用 V1 last-wins 语义，新的 Jump 取消旧的未完成 Jump。

### Keyboard / Focus

V2 保留键盘导航，但操作对象从密集 Rib 改为 Prompt Row。

```text
ArrowUp / ArrowDown → previous / next Prompt Row
Home                → first Prompt Row
End                 → last Prompt Row
Enter / Space       → Jump
Escape              → close Overview and return Focus to Compact Rail
Shift + Alt + M     → open Navigator and focus Current Prompt Row
```

键盘激活 Jump 后继续复用 V1 Jump Focus 语义。

Pointer Jump 不额外抢夺 Turn Focus。

### State Semantics

V1 的状态关系保持不变：

```text
Current != Visible != Focused
```

- Current 继续由 Session viewport 顶部向下 30% Reading Anchor 决定。
- Visible 继续表示当前 viewport 相交的 Turn。
- Focused 表示用户正在 Prompt Overview 中操作的 Row。
- Hover / Focus 不能反推 Current。
- Current 更新不能打断用户正在浏览 Overview。

V2 可以不再把 Visible 映射成不同 Rib 宽度，但不能删除底层 Visible 语义。

### Navigation Runtime

以下 V1 能力继续复用，不重新实现：

- Turn Navigation Index。
- USER Prompt Preview Contract。
- Reading Anchor。
- Current / Visible 计算。
- `useTurnNavigator` Jump Controller。
- unloaded Turn → Target Message Window。
- last-wins / AbortController。
- latest / history window 分离。
- Streaming 不抢历史阅读位置。
- Optimistic Turn 去重。
- placeholder remount 后再完成 Jump / Focus。
- 500 Turn Heavy DOM Windowing。

Backend API、DTO、Message Window Contract 不变化。

### V1 Surface Retirement

以下是 V1 的交互表现形式，不再属于 V2 Contract：

- 常驻 Previous / Next 按钮。
- 常驻 Origin / Terminus 按钮。
- 全量 Rib 常驻展示。
- Hover 单条 Tooltip。
- Drag-to-jump。
- Fisheye。

删除这些表现形式，不等于删除之前得到的设计经验。

V2 仍必须保留：

- Interaction 期间不得被 Current auto-follow 抢走。
- Pointer / Focus 清理必须完整。
- Jump 必须 last-wins。
- Focus 必须可恢复。
- 未加载历史只在最终选择后加载正文。
- 长 Session 不得因为 Navigator 加载全部 Message 正文。

PR2 允许先停止使用 V1 Drag / Fisheye。

只有确认无真实引用后，PR3 才删除相关旧代码与旧测试。

### Long Session

Navigation Index 继续包含完整正式 Turn 集合。

UI 分层：

```text
Collapsed
→ at most 5 local markers

Expanded
→ lightweight Prompt Rows
→ bounded scroll container

Conversation
→ existing Heavy DOM Windowing
```

打开 Overview 不得触发全部 Message 加载。

500 Turn 下允许存在 500 条轻量 Prompt Preview。

V2 不新增 Prompt Row virtualization；只有真实性能证据出现后再单独设计。

## Flow

```text
load Session
→ load existing Navigation Index
→ render Compact Rail

hover / focus Navigator
→ open Prompt Overview
→ keep Current Row visible unless user is interacting

select Prompt Row
→ existing Jump Controller
→ target loaded?
   ├─ yes → align Turn
   └─ no  → load Target Message Window
          → render target
          → align Turn

leave Interaction Surface
→ close Prompt Overview
→ keep Compact Rail
```

Streaming / History 继续走 V1 Runtime：

```text
user reads history
→ Current can change
→ Streaming continues
→ Navigator does not force latest

user returns latest
→ existing follow-latest semantics
```

## Acceptance

PR3 Review 需要同时证明 V2 Surface 与 V1 Runtime 没有互相污染。

Surface evidence：

- Compact Rail 默认最多 5 个邻近 marker，并覆盖 Session 起点 / 中部 / 终点窗口。
- Collapsed 时 Prompt List 不常驻 DOM。
- Hover / Focus 打开唯一 Prompt Overview，Current Row 明确。
- Overview 打开时 Current Row 自动进入可见范围。
- 用户开始 Pointer / Wheel / Keyboard 操作 Overview 后，Current 更新不再抢走列表位置。
- Rail → Panel 跨越 grace period 不闪退。
- Arrow / Home / End / Enter / Space / Escape 与 `Shift + Alt + M` 已有行为回归。
- Jump pending 时仍可选择新 Prompt。

Runtime evidence：

- V1 Drag / Fisheye 专属 Geometry 与测试已经删除。
- `useTurnNavigator` 不再暴露 Preview / Previous / Next / Origin / Terminus 等旧 Surface API。
- unloaded Turn、placeholder remount、last-wins、Reading Anchor、Visible 与 Windowing 继续保留。
- SessionWorkspace 历史 Jump、Streaming / History reading position 与返回 latest 行为继续由现有回归保护。
- Backend API / DTO / persistence 无变化。

Acceptance Review 已闭环：

- V2 Surface 与 V1 Navigation Runtime ownership 已对齐。
- 旧 Drag / Fisheye Surface 与无引用 Runtime API 已清理。
- Surface、Jump、History、Streaming、Windowing 的回归证据完整。
- Known Gaps = none。
- 最终 Done Commit 必须通过 Frontend Verification、Backend Verification 与 `Yakable / Quality Gate`；CI Evidence 记录在实现 PR。

## Boundary

Owns:
- Compact Rail visual surface
- Prompt Overview
- Navigator open / close interaction
- Prompt Row keyboard navigation
- Current Row presentation

Reuses:
- Turn Identity
- Current / Visible
- Reading Anchor
- Jump Controller
- Message Window
- History / latest semantics
- Windowing

Does Not Own:
- Session Search
- cross-Session navigation
- Message editing
- Prompt editing
- Turn execution
- Backend navigation contract
- Mobile Navigator
- Prompt Row virtualization
- new Conversation state store

Implementation sequence:

```text
PR1 — Interaction V2 Design
PR2 — Compact Rail + Prompt Overview
PR3 — Interaction Cleanup + Acceptance
```

PR2 不为了视觉改造重写 `useTurnNavigator`。

PR3 只删除已经被 V2 真实替代且无引用的旧 Drag / Fisheye 代码，并完成 V1 Runtime invariant 回归。

V1 `Status: Done` 保持不变。

V2 在代码、测试和 Acceptance 对齐前保持 `Status: Designing / Implementing / Review`，不能提前标记为 `Done`。
