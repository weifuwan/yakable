# Turn Navigator

Status: Done
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
- Turn Boundary: `yakable-ui/src/features/session/components/TurnItem.tsx`
- Message Window: `yakable-ui/src/features/session/hooks/useSessionMessageWindow.ts`
- Interactive Rail: `yakable-ui/src/features/session/components/turn-navigator/TurnNavigator.tsx`
- Interaction State Machine: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigatorInteraction.ts`
- Navigation State / Jump Focus: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigator.ts`
- Conversation + Rail Geometry: `yakable-ui/src/features/session/components/turn-navigator/turn-navigation.ts`
- Heavy DOM Windowing: `yakable-ui/src/features/session/hooks/useTurnWindowing.ts`
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
- `yakable-ui/src/features/session/components/__tests__/TurnItem.test.tsx`
- `yakable-ui/src/features/session/hooks/__tests__/useSessionMessageWindow.test.ts`
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/turn-navigation.test.ts`
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/TurnNavigator.test.tsx`
- `yakable-ui/src/features/session/components/turn-navigator/__tests__/useTurnNavigator.test.tsx`
- SessionWorkspace basic navigation integration
- Navigator geometry / Drag / Fisheye / Focus / Keyboard regression tests
- `yakable-ui/src/features/session/hooks/__tests__/useTurnWindowing.test.tsx`
- 500 Turn long-session windowing acceptance
- 500 Turn Hook lifecycle / scroll / resize bounded-Heavy-DOM regression
- placeholder active-Jump remount / final-focus regression

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
- Message Window 状态由 `useSessionMessageWindow` 单独拥有；SessionWorkspace 不再维护第二份 Message 数组。
- 每个已渲染 Turn 使用一个 `TurnItem` 顶层 Anchor；同一 Turn 的 USER / ASSISTANT / Streaming / Thinking / Failure 必须落在同一边界内。
- Message Window 切换或历史 prepend 后必须重新按 turnId 聚合，不能把一个 Turn 拆成多个 DOM Anchor。
- Current Turn 已按 viewport 顶部向下 30% Reading Anchor 实现；Visible Turn 由 viewport intersection geometry 独立计算。
- Basic Navigator 在少于 3 个正式 Turn 时不显示，窄屏隐藏；Rail 提供 Current / Visible 状态、共享 Prompt Preview、Click、Previous / Next、Origin / Terminus。
- Jump 已统一支持当前窗口与未加载历史：未加载 Turn 先按 USER Message sequence 查询 Target Message Window，再对齐 Reading Anchor。
- 当前 DOM 中存在 turnId 不代表 Turn 起点已加载；只有该 Turn 的 USER Message 已在 Message Window 中时才能直接 Jump，否则仍需加载 Target Message Window。
- Origin / Terminus 固定在可滚动 rib column 外；Origin 定位 Session start，Terminus 定位 latest 并恢复 follow latest。
- 当前显示 Message Window 与 Session 最新 sequence 分离；跳到历史窗口不得让 Streaming / Reconnect 的 afterSequence 回退。
- Drag 已使用 4px movement threshold；Pointer Move 只更新共享 Preview / Fisheye / drag target，release 后才执行最终 Jump，未加载历史不会在拖动过程中连续请求正文。
- Pointer cancel / window blur 会清理 drag state；完成 Drag 后抑制紧随其后的 synthetic click，避免重复 Jump。
- Fisheye 只通过 rib visual 的 horizontal transform 放大，不修改固定 row height、row order 或纵向 hit target；Hover/Drag 均使用同一份 measured rib layout。
- Navigator rib 使用 roving tabindex；ArrowUp / ArrowDown / Home / End 只移动 Navigator Focus，Enter / Space 通过统一 Jump 语义激活目标。
- 键盘激活 Jump 后 Focus 进入目标 TurnItem；Pointer Click / Drag 不额外抢夺目标 Focus。
- `Shift + Alt + M` 将 Focus 返回 Current rib；Hover / Focus / Drag 继续共用一个 Prompt Preview。
- 用户 Pointer / Focus / Drag 操作 Rail 时暂停 Current 自动跟随；Rail hit-test 与 Fisheye 在 rail content space 中统一计算。
- Jump 请求使用 last-wins 语义；新的 Click / Keyboard / Drag / Origin / Terminus 会取消旧的未完成 Target Window 请求，只有当前 Jump 可以 replace Message Window、scroll 或 focus。
- Navigator 在 Jump pending 期间保持可交互，用于允许用户替换慢网络下的旧目标；isJumping 只作为 busy 状态，不作为目标切换锁。
- Terminus 与现有 Scroll-to-bottom 都恢复真正的 latest Message page，而不是只滚到当前历史窗口底部。
- 在历史窗口发送新 Prompt 时，先取消未完成的历史 Jump、恢复 follow-latest，并异步恢复 latest page；Optimistic Turn 转正式 Turn 后只保留一个 USER 节点。
- 用户停留历史窗口时，后台 Streaming 继续推进 Turn 状态与 Session latest sequence，但与当前历史 Turn 无关的新 Message 不注入当前 Message Window。
- 长 Session Windowing 只卸载 Turn Anchor 内部的 Heavy Message / Markdown subtree；所有已加载 Turn Anchor 始终保留在 DOM 中。
- Turn 首次真实渲染后通过 ResizeObserver 记录精确高度；off-window Turn 使用 exact-height placeholder，不能用估算高度替代已测量高度。
- Windowing 默认保留 viewport 前后各 1.5 个 viewport 的 overscan；Current / Streaming / Optimistic / active Jump / Focused Turn 强制保持真实 DOM。
- placeholder 保留 data-turn-id / data-turn-key / data-turn-user-loaded / tabIndex，因此 Current、Jump、Previous / Next 与 Focus 语义不因 Heavy DOM 卸载而改变。
- Session viewport 宽度变化时不全量清空高度缓存；已挂载 Turn 通过 ResizeObserver 刷新精确高度，off-window placeholder 暂时保留最近一次测量高度，进入 overscan 后再渐进重测，避免一次性重新挂载全部 Heavy Markdown。
- 500 Turn 验收允许 500 个轻量 Anchor 常驻，但在高度已测量后 Heavy Turn DOM 必须受 viewport overscan + pinned Turn 集合约束；scroll / resize 后同样不能退化为全量 Heavy DOM。

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

- 已实现：卸载远处复杂 Markdown 时保留 Turn Anchor 与已测量高度，scroll geometry 不随 Heavy DOM 卸载塌缩。
- 已实现：off-window Turn 使用 exact-height placeholder；未知高度 Turn 先真实渲染完成测量，不以估算值替代精确值。
- 已实现：viewport + overscan、Streaming、Optimistic、Current、Keyboard Focus、active Jump target 保持真实 DOM。
- 已实现：viewport 宽度变化不会触发全量 Heavy DOM remount；当前 mounted / overscan Turn 通过 ResizeObserver 刷新高度，远处 placeholder 保留最近一次测量几何直到重新进入 window。
- 已实现：active Jump target 即使当前只是 placeholder，也会先 pin 并等待真实 Turn subtree remount，再执行最终 scroll / focus。
- Windowing 只减少 Heavy DOM，不能破坏 Current、Jump、Previous / Next、Focus 或 Rail 定位语义。

## Acceptance

Turn Navigator V1 已完成 PR1～PR6 Capability Acceptance。

验收证据：

- Navigation Data Contract、Turn Render Boundary、Current / Visible、Basic Navigator、Drag / Fisheye / Accessibility、Streaming / History Jump 均已有回归保护。
- 500 Turn Windowing 不再只验证 selector；已覆盖真实 Hook lifecycle、scroll、resize 与 bounded Heavy DOM。
- placeholder active Jump 已覆盖：目标先 pin，真实 Turn subtree remount 后才执行最终 scroll / focus。
- viewport resize 不再清空全部高度导致全量 Heavy DOM remount；远处 placeholder 保留最近测量几何并在进入 window 后渐进重测。
- 正式 CI 已移除临时 formatter 诊断步骤。
- Acceptance Fix 已通过完整 Frontend Verification、Backend Verification 与 Quality Gate。

`Status: Done` 表示上述 Contract 与 V1 Acceptance 已闭环；后续新增能力需要新的 Capability / Contract，不继续向 V1 范围叠加。

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

V1 implementation and acceptance are complete.
