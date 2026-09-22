# Turn Navigator

Status: Implementing
Domain: Conversation

Depends On:
- [History](./history.md)
- [Streaming](./streaming.md)

Related:
- [Send Message](./send-message.md)
- [Reconnect](./reconnect.md)
- [Stop](./stop.md)

Frontend:
- Contract: `yakable-ui/src/service/session/SessionService.ts`
- Contract Types: `yakable-ui/src/service/session/types.ts`
- Planned: `yakable-ui/src/features/session/components/TurnItem.tsx`
- Planned: `yakable-ui/src/features/session/components/turn-navigator/TurnNavigator.tsx`
- Planned: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigator.ts`
- Planned: `yakable-ui/src/features/session/components/turn-navigator/turn-navigation.ts`
- Existing host: `yakable-ui/src/features/session/components/SessionWorkspace.tsx`

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
- Planned: TurnNavigator component tests
- Planned: SessionWorkspace navigation integration tests
- Planned: Navigator geometry / drag / focus / windowing invariant regression tests
- Planned: 500 Turn long-session test

## Purpose

解决长 Session 中快速定位某一轮的问题。

导航单位是 Turn，不是 Message。

## Contract

- 少于 3 个正式 Turn 时桌面端不显示 Navigator。
- 每个正式 Turn 只有一个导航节点。
- Current Turn 使用固定 Reading Anchor，V1 为 viewport 顶部向下 30%。
- Hover / Focus / Drag 共用一个 Prompt Preview。
- Click / Previous / Next / Origin / Terminus / Keyboard / Drag 使用同一套 Turn Identity 和 Jump 语义。
- Drag 经过未加载历史时不连续请求正文，只在 release 后加载最终目标窗口。
- Streaming 不得抢夺用户正在阅读的历史位置。
- Optimistic Turn 转正式 Turn 时不能产生重复节点。
- 完整 Navigation Index 不等于加载全部 Message 正文。
- 500 Turn 下允许轻量导航项存在，但复杂 Markdown 不能全部长期常驻 DOM。
- 键盘使用 roving tabindex，支持 Arrow / Home / End / Enter / Space。
- 窄屏 V1 隐藏 Navigator。
- Navigation Index 只返回正式 USER Message 对应的 Turn 节点，按 Message Sequence 升序；Preview 服务端收敛空白并限制为最多 160 个 Unicode code point。
- Target Message Window 固定最多 50 条 Message，目标 anchor 必须存在且包含在窗口内；返回 hasOlder / hasNewer 与对应边界 cursor。

## Frontend Design Invariants

以下规则是 Turn Navigator 的实现不变量，不是视觉细节。

### 1. Single Coordinate Space

- Conversation 侧的 Turn top / Current / Previous / Next / Jump target 必须统一到 Session scroll content space。
- Rail 侧的 Hover / Preview / Click / Drag hit-test 必须统一读取同一份 measured rib layout，并在 rib column content space 中计算。
- 禁止直接比较来自不同 `offsetParent`、viewport、scroll container 或 rail column 的坐标值。

### 2. Geometry Must Stay Stable

- Hover / Fisheye / Focus 动画不得改变 rib row height、row order 或纵向 hit target。
- rib row 必须保持固定几何；长 Rail 下不能因为 flex shrink 改变实际命中高度。
- 视觉放大可以变化，交互 Geometry 不能被动画本身改写。

### 3. Origin / Terminus Are Pinned

- Origin / Terminus 固定在 scrollable rib column 外，不随中间 rib 滚走。
- pinned node 不参与中间 rib 的 index / proportional mapping。
- Origin 与 Terminus 分别复用统一的 Session start / latest Jump 语义。

### 4. Current != Visible != Focused

- Current：Reading Anchor 命中的唯一 Turn。
- Visible：当前与 viewport 相交的 Turn 集合。
- Focused / Hovered / Drag Target：用户当前正在操作的 Navigator 目标。
- 三种状态独立维护，不能用 IntersectionObserver、Focus 或 Hover 反推 Current。

### 5. Interaction Freezes Rail Auto-follow

- Pointer、Keyboard Focus、Drag 或用户主动滚动 Rail 时，暂停 Rail 自动重新居中。
- 交互期间 Current 可以继续更新，但不能把 rib 从用户指针或键盘焦点下移走。
- 交互结束后才恢复 Rail 跟随 Current。

### 6. Drag Is A Gesture

- Drag 使用明确 movement threshold；V1 保持 4px。
- 必须处理 pointer up / pointer cancel / window blur 清理。
- Drag 完成后必须抑制浏览器紧随其后的 synthetic click，避免二次 Jump 或 Focus 抢夺。
- Drag target 与 Hover / Preview / Click 共用同一 measured rib layout；未加载历史仍只在 release 后请求最终目标窗口。

### 7. Jump Owns Focus Semantics

- Click / Previous / Next / Origin / Terminus / Keyboard / Drag 最终都进入同一个 Jump Controller。
- Keyboard 激活 Jump 后，Focus 必须进入目标 TurnItem，不能只改变 scrollTop。
- Navigator 必须提供明确的返回 Focus 路径；V1 使用 `Shift + Alt + M` 回到当前 rib。
- Pointer Jump 不应产生与键盘导航无关的额外 Focus 跳动。

### 8. Windowing Must Preserve Geometry

- 卸载远处复杂 Markdown 时必须保留 Turn Anchor 与已测量高度，不能让 scroll geometry 塌缩。
- off-window Turn 使用 exact-height placeholder；目标进入 render window 后再挂载真实 TurnItem 并执行 final snap。
- viewport / overscan / Streaming / Keyboard Focus / active Jump target 必须保持真实 DOM。
- Windowing 优化只能减少 Heavy DOM，不能破坏 Current、Jump、Previous / Next 或 Rail 定位语义。

## Flow

```text
load Session
→ load lightweight Navigation Index
→ render Turn rail

user selects Turn
→ target already in Message Window?
   ├─ yes → jump
   └─ no  → load target Message Window
          → render
          → jump

streaming delta
→ update Turn content
→ keep current reading position unless user is following latest
```

## Boundary

Owns:
- current Turn navigation
- prompt preview
- turn jump
- drag / keyboard navigation
- long-session navigation rendering

Does Not Own:
- Session Search
- cross-Session navigation
- Message editing
- Turn execution
- Context selection

Design must be reviewed against current SessionWorkspace before implementation starts.
