# Turn Navigator

Status: Done
Domain: Conversation

Depends On:
- [History](./history.md)
- [Streaming](./streaming.md)

Related:
- [Turn Navigator Interaction V2](./turn-navigator-interaction-v2.md)
- [Send Message](./send-message.md)
- [Reconnect](./reconnect.md)
- [Stop](./stop.md)

Frontend:
- Contract: `yakable-ui/src/service/session/SessionService.ts`
- Contract Types: `yakable-ui/src/service/session/types.ts`
- Turn Boundary: `yakable-ui/src/features/session/components/TurnItem.tsx`
- Message Window: `yakable-ui/src/features/session/hooks/useSessionMessageWindow.ts`
- Viewport / Follow Latest: `yakable-ui/src/features/session/hooks/useSessionViewport.ts`
- Navigation Runtime: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigator.ts`
- Conversation Geometry: `yakable-ui/src/features/session/components/turn-navigator/turn-navigation.ts`
- Heavy DOM Windowing: `yakable-ui/src/features/session/hooks/useTurnWindowing.ts`
- Current Interaction Surface: `yakable-ui/src/features/session/components/turn-navigator/TurnNavigator.tsx`

Backend:
- API: `GET /api/projects/{projectId}/sessions/{sessionId}/turns/navigation`
- API: `GET /api/projects/{projectId}/sessions/{sessionId}/messages/window?anchorSequence={sequence}`
- Host: `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- Host: `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`

Data:
- Turn
- USER Message Preview
- Message Window

Shared Rules:
- CONV-005
- CONV-006
- CONV-014

Scenarios:
- CONV-S03
- CONV-S06

Tests:
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/turn-navigation.test.ts`
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/useTurnNavigator.test.tsx`
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/TurnNavigator.test.tsx`
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/features/session/hooks/__tests__/useTurnWindowing.test.tsx`

## Purpose

为长 Session 提供稳定的 Turn 定位 Runtime。

导航单位是 Turn，不是 Message。

视觉与 Pointer / Keyboard Interaction 由 [Turn Navigator Interaction V2](./turn-navigator-interaction-v2.md) 拥有，本 Capability 只保留与 Surface 无关的导航事实。

## Contract

- Navigation Index 只返回正式 USER Message 对应的 Turn，按 Message Sequence 升序。
- Preview 服务端收敛空白并限制为最多 160 个 Unicode code point。
- Current Turn 使用固定 Reading Anchor，当前为 viewport 顶部向下 30%。
- Visible Turn 表示与 viewport 相交的 Turn；Current、Visible、Focused 是不同状态。
- 完整 Navigation Index 不等于加载全部 Message 正文。
- Jump 到当前 Message Window 中已完整加载的 Turn 时直接对齐 Reading Anchor。
- Jump 到未加载历史时，先按 USER Message sequence 查询 Target Message Window，再渲染并对齐。
- DOM 中存在 turnId 不代表 Turn 起点已经加载；只有 USER Message 已在当前 Window 时才能直接 Jump。
- Target Message Window 最多 50 条 Message，并返回 hasOlder / hasNewer 与边界 cursor。
- Jump 使用 last-wins；新目标取消旧的未完成 Target Window 请求，只有最新 Jump 可以 replace Window、scroll 或 focus。
- Jump pending 不锁死 Navigator，Surface 可以继续提交新目标。
- Keyboard 激活可以请求最终 Focus 进入目标 Turn；Pointer Jump 不额外抢夺 Turn Focus。
- Streaming 不得抢夺用户正在阅读的历史位置。
- 当前显示 Message Window 与 Session 最新 sequence 分离，历史 Jump 不得让 Streaming / Reconnect 游标回退。
- Optimistic Turn 转正式 Turn 时不能产生重复 USER 节点。
- 长 Session Windowing 只卸载 Heavy Message / Markdown subtree，Turn Anchor 与已测量 Geometry 保持稳定。
- Current / Streaming / Optimistic / active Jump / Focused Turn 在需要时保持真实 DOM。
- 500 Turn 下允许轻量 Navigation Index 与 Turn Anchor 存在，但 Heavy DOM 必须受 viewport window + pinned Turn 约束。
- 窄屏是否展示 Navigator 属于 Interaction Surface Contract。

## Frontend Design Invariants

### 1. Conversation Geometry Uses One Coordinate Space

Turn top、Current、Visible 与 Jump target 全部使用 Session scroll content space。

禁止直接比较来自不同 viewport、scroll container 或 offset parent 的坐标。

### 2. Current != Visible != Focused

- Current：Reading Anchor 命中的唯一 Turn。
- Visible：当前 viewport 相交 Turn 集合。
- Focused：Interaction Surface 当前操作目标。

Hover / Focus 不能反推 Current。

### 3. Interaction Must Not Redefine Runtime State

Surface 可以决定展示、选中和 Focus，但不能重写 Current、History Window 或 Streaming follow-latest 事实。

用户操作 Navigator 时，Surface 自己负责暂停视觉 auto-follow，不改变 Runtime 的 Current 计算。

### 4. Jump Owns History Load And Focus

所有 Prompt Row 选择最终进入同一个 `jumpToTurn`。

Jump Controller 负责：

- unloaded history load。
- placeholder remount。
- Reading Anchor alignment。
- optional target focus。
- last-wins cancellation。

### 5. Windowing Must Preserve Geometry

Heavy DOM 卸载不能破坏 Current、Jump、Focus 或 scroll geometry。

已测量 Turn 使用 exact-height placeholder；active Jump target 必须先 remount，再完成最终 scroll / focus。

## Acceptance

当前 Runtime 已由以下回归保护：

- Reading Anchor / Visible / targetScrollTop 的纯 Geometry 测试。
- unloaded Turn → Target Message Window → Jump。
- placeholder target remount → final focus。
- overlapping Jump 的 last-wins / AbortController。
- SessionWorkspace 的历史 Jump 与返回 latest 集成。
- 500 Turn Windowing 的 bounded Heavy DOM 与 placeholder geometry。

V1 的 Drag / Fisheye / Origin / Terminus / Previous / Next 属于旧 Interaction Surface，不再属于本 Runtime Contract。

## Flow

```text
load Session
→ load lightweight Navigation Index
→ calculate Current / Visible from rendered Turn geometry

select Turn
→ begin latest Jump
→ target fully rendered?
   ├─ yes → align
   └─ no  → load Target Message Window
          → wait for target Turn remount
          → align

newer Jump arrives
→ abort previous Jump
→ only latest Jump may commit
```

## Boundary

Owns:
- Navigation Index consumption
- Current / Visible calculation
- Turn jump
- unloaded history target loading
- Jump cancellation / focus semantics
- navigation geometry

Does Not Own:
- Compact Rail / Prompt Overview visual design
- Pointer / Keyboard surface interaction
- Session Search
- cross-Session navigation
- Message editing
- Turn execution
- Context selection
