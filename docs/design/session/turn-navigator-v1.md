# Yakable Turn Navigator Frontend Design V1

> 状态：Draft  
> 版本：V1  
> 对应 PRD：`docs/prd/session/turn-navigator-v1.md`  
> 范围：Yakable UI / Session

## 1. 设计目标

Turn Navigator 只解决长 Session 中的 Turn 定位，不改变 Session、Turn、Message 的业务语义。

V1 的核心约束：

- 以 Turn 为唯一导航单位。
- Navigator 由数据驱动，不扫描 DOM 生成业务数据。
- Current、Preview、Click、Drag、Keyboard 共用同一套 Turn Identity。
- Streaming / Optimistic 不产生重复节点。
- 完整 Navigator 不要求一次性加载全部 Message 正文。
- 500 Turn 下不允许全部 Markdown 长期常驻 DOM。
- 不新增全局 Store，不新增虚拟列表依赖。

## 2. 当前实现

当前 `SessionWorkspace` 已有：

```text
querySession
  ├── turns[]      -> 当前 Session 全部 Turn
  └── messages[]   -> 最近 50 条 Message

scrollRef
followOutputRef
optimisticMessage
streamingMessage
loadOlderMessages
scrollToBottom
```

现有能力可以直接复用：

- Session 初始加载。
- Streaming / Stop / Recovery。
- 最近 50 条 Message。
- 向上历史分页。
- 用户离开底部后停止自动跟随。
- 回到底部入口。

当前真正缺少的是：

```text
完整 Turn Prompt Index
Turn 级 DOM Anchor
Current Turn
统一 Jump Controller
未加载 Turn 的 Target Window
Navigator Rail / Preview / Drag / Fisheye / Keyboard
长 Session DOM Window
```

## 3. 总体结构

```text
SessionWorkspace
├── useSessionMessageWindow
├── useTurnNavigator
├── MessageViewport
│   └── TurnItem
│       ├── USER MessageItem
│       ├── ASSISTANT MessageItem
│       └── Thinking / Failure / Streaming
└── TurnNavigator
    ├── origin
    ├── rib column
    ├── terminus
    └── shared Prompt Preview
```

建议目录：

```text
features/session/
├── components/
│   ├── SessionWorkspace.tsx
│   ├── MessageItem.tsx
│   ├── TurnItem.tsx
│   └── turn-navigator/
│       ├── TurnNavigator.tsx
│       ├── useTurnNavigator.ts
│       └── turn-navigation.ts
└── hooks/
    └── useSessionMessageWindow.ts
```

不为了形式继续拆 `TurnNavigatorItem`、`TurnNavigatorPreview` 等小组件。

## 4. 数据模型

### 4.1 TurnNavigationEntry

```ts
interface TurnNavigationEntry {
  key: string;
  turnId: string | null;
  userMessageId: string | null;
  userMessageSequence: number | null;
  preview: string;
  persisted: boolean;
}
```

正式历史项：

```text
key = turn:<turnId>
```

Optimistic：

```text
key = optimistic:<requestId>
```

`onStarted` 后直接补齐原 Entry：

```text
turnId
userMessageId
userMessageSequence
persisted = true
```

不能再 append 第二个 Entry，也不能通过 Prompt 文本匹配 Optimistic Turn。

### 4.2 TurnRenderModel

Message 不再直接平铺。

```ts
interface TurnRenderModel {
  key: string;
  turnId: string | null;
  userMessage: SessionMessage | null;
  assistantMessages: SessionMessage[];
  streamingMessage: SessionMessage | null;
  status: TurnStatus | 'OPTIMISTIC';
}
```

`Thinking...`、Failure、Partial Answer、Streaming 都属于对应 TurnItem。

### 4.3 Message Window

```ts
interface SessionMessageWindow {
  messages: SessionMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  olderCursor: number | null;
  newerCursor: number | null;
}
```

Navigation Index 与 Message Window 必须分离：

```text
Navigation Index = 整个 Session 的轻量 Turn 索引
Message Window   = 当前正文需要展示的一段 Message
```

## 5. 所需数据契约

当前 API 已返回全部 Turn，但旧 Turn 的 USER Prompt 不一定存在于最近 50 条 Message 中，因此还缺两个契约。

### 5.1 Turn Navigation Index

前端需要：

```text
SessionService.queryTurnNavigation(projectId, sessionId)
```

返回：

```ts
interface SessionTurnNavigationItem {
  turnId: string;
  userMessageId: string;
  userMessageSequence: number;
  preview: string;
}
```

规则：

- 只返回正式成立 Turn。
- 按 USER Message sequence 升序。
- 不返回 Assistant 正文。
- Prompt 空白在服务端收敛。
- Preview 服务端限长，建议最多 160 个 Unicode 字符。
- Turn 动态状态继续使用现有 `snapshot.turns`。

### 5.2 Target Message Window

现有 `queryMessages(beforeSequence)` 只能不断向前翻页，不能直接跳到很老的 Turn。

前端需要：

```text
SessionService.queryMessageWindow(
  projectId,
  sessionId,
  anchorSequence
)
```

返回：

```ts
interface SessionMessageWindowResult {
  messages: SessionMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  olderCursor: number | null;
  newerCursor: number | null;
}
```

目标 USER Message 必须包含在窗口中。默认窗口约 50 条 Message，目标附近前后各保留一部分。

这个能力只用于“跳到未加载 Turn”，不是把全部历史一次性拉到浏览器。

## 6. TurnItem

每个 Turn 必须有一个顶层 DOM Anchor：

```tsx
<section
  data-turn-id={turnId}
  data-turn-key={key}
  tabIndex={-1}
>
  ...
</section>
```

TurnItem 负责：

- 包住该轮 USER / ASSISTANT / Streaming / Error。
- 提供唯一 Scroll Anchor。
- 提供 Keyboard Focus Target。
- 提供高度测量边界。

TurnItem 不负责 Navigator 业务。

## 7. Message Window

### 7.1 初始进入

保持当前行为：

```text
最近 50 条 Message
hasOlder = hasMoreMessages
hasNewer = false
```

默认定位最新位置。

### 7.2 正常历史滚动

顶部附近：

```text
load older
-> prepend
-> 补偿 scrollHeight 差值
```

从历史 Target Window 向下阅读时，如果 `hasNewer = true`，底部附近加载较新的 Message。

### 7.3 Jump 到未加载 Turn

```text
jumpToTurn
    ↓
TurnItem 已存在？
 ├─ yes -> scroll
 └─ no
      ↓
queryMessageWindow(targetSequence)
      ↓
成功后切换 active window
      ↓
render
      ↓
scroll target
```

请求过程中原正文保持不动。

新的 Jump 到来：

```text
abort old request
invalidate old scroll
只执行 latest target
```

加载失败不改变当前正文位置。

## 8. Current Turn

### 8.1 Reading Anchor

V1 固定使用消息 viewport 顶部向下 **30%** 的位置。

```text
0%   ────────────

30%  ── anchor ──

100% ────────────
```

规则：

- Anchor 落入某个 TurnItem：该 Turn 为 Current。
- 落入两个 Turn 之间：取上方最近 Turn。
- Session 顶部：最早已显示 Turn。
- Session 真正底部：最新 Turn。
- 任意时刻只有一个 Current。

Current 不使用“IntersectionObserver 第一个回调项”推断。

### 8.2 Visible Turn

`IntersectionObserver` 只维护与 viewport 相交的 Turn 集合，用于次一级高亮。

### 8.3 Layout 更新

```text
scroll
-> requestAnimationFrame
-> Current calculation

ResizeObserver
-> invalidate Turn geometry
```

Streaming、Markdown、代码块、图片导致高度变化时重新测量。

不使用 MutationObserver 维护 Turn Identity。

## 9. 统一 Scroll Controller

所有入口都必须调用：

```text
jumpToTurn(turnKey)
jumpToLatest()
```

包括：

- rib click。
- Preview click。
- Previous / Next。
- Origin / Terminus。
- Keyboard。
- Drag release。

### 9.1 Smooth Jump

目标已加载时，每帧重新读取 TurnItem 相对位置，而不是一次计算后完全依赖旧坐标。

原因：

```text
scroll animation
+
Streaming / Markdown layout change
=
target position may move
```

使用 scroll token：

```text
new jump
-> old token invalid
```

快速连续点击最终只到最后一个目标。

### 9.2 Reduced Motion

`prefers-reduced-motion: reduce`：

- Turn Jump 直接定位。
- Fisheye 不做连续放大动画。
- Preview / Click / Drag / Keyboard 保留。

### 9.3 Latest

现有 Scroll-to-Bottom 与 Navigator Terminus 统一调用 `jumpToLatest()`。

如果当前不是 latest Message Window：

```text
load latest window
-> scroll bottom
```

最后统一：

```text
followOutputRef = true
currentTurn = latest
```

## 10. Turn Navigator Rail

Navigator 是 Message scroll container 的绝对定位 sibling：

```text
workspace body
├── message scroll container
└── TurnNavigator
```

不参与正文布局，不改变正文宽度。

Rail：

```text
origin
  ↓
scrollable rib column
  ↓
terminus
```

Origin / Terminus 固定，不跟中间 rib 一起滚走。

长 Session：

- rib column 自己滚动。
- 隐藏 scrollbar。
- 默认把 Current rib 保持在中部附近。
- Pointer / Focus / Drag 期间暂停自动居中。
- 用户可用滚轮浏览远处 rib。

## 11. Rib 状态

```text
focused > current > visible > dim
```

Current 在静止状态下就比普通 rib 更长。

Hover 只增加交互强调，不能覆盖 Current / Visible 语义。

所有 rib 使用固定 row height，防止 Fisheye 导致纵向 reflow。

## 12. Shared Prompt Preview

整个 Navigator 只有一个 Preview。

优先级：

```text
drag target
> keyboard focused target
> pointer hovered target
```

Preview：

- 只展示一个 USER Prompt。
- 直接读取 Navigation Entry。
- 不读 DOM textContent。
- 换行收敛。
- 长文本省略。
- 点击调用同一个 `jumpToTurn`。
- 已打开后切换 Turn 即时更新。
- 不给每个 rib 创建独立 HoverCard。

## 13. Fisheye

Fisheye 热路径不走 React state：

```text
pointermove
-> requestAnimationFrame
-> ribLayoutRef
-> cosine falloff
-> direct width / height update
```

只改变：

```text
rib width
rib thickness
```

不改变：

```text
row height
row order
hit target vertical position
```

因此鼠标下的 rib 不会因为自己变大而移动。

## 14. Drag-to-Scrub

`pointerdown` 记录起点。

移动距离：

```text
< 4px  -> click candidate
>= 4px -> dragging
```

Pointer move / up / cancel 使用 document 级监听。

Drag 后抑制紧随其后的 synthetic click。

### 14.1 Unified Rib Layout

Hover、Fisheye、Preview、Click、Drag 共用同一个 `ribLayoutRef`。

Pointer 统一转换：

```text
clientY
-> column rect
-> + column.scrollTop
-> nearest rib
```

禁止不同交互分别按比例、index、offsetTop 猜目标。

### 14.2 History

已加载 Turn：

```text
drag -> 可以实时正文跟随
```

未加载 Turn：

```text
drag -> 只更新 target + Preview
release -> query target window once
```

Drag 中禁止连续加载历史。

## 15. Optimistic / Streaming

Navigator 已经显示时，发送 Prompt 立即 append：

```text
optimistic:<requestId>
```

Navigator 还没达到 3 个 persisted Turn 时，不因为 Optimistic Entry 单独出现。

`onStarted`：

```text
same Entry
-> fill turnId
-> fill userMessageId
-> fill sequence
-> persisted = true
```

Streaming delta 只更新对应 TurnItem，不允许：

- rebuild 整个 Navigation Index。
- 强制 Current = latest。
- 强制 Rail 回 latest。

用户停留最新位置时正常 follow；用户已阅读历史时完全尊重历史位置。

## 16. Keyboard Accessibility

Rail 使用 roving tabindex，只保留一个 Tab stop。

```text
focused/current rib -> tabIndex=0
other ribs         -> tabIndex=-1
```

键盘：

```text
ArrowUp / ArrowDown -> 前后一个 Turn
Home / End           -> 最早 / 最新
Enter / Space        -> jump
```

Jump 完成后：

```text
TurnItem.focus({ preventScroll: true })
```

快捷键：

```text
Shift + Alt + M
```

只有 Navigator 确实可见且 focus 成功时才 `preventDefault()`。

## 17. 长 Session DOM Window

允许存在 500 个轻量 Navigation Entry 和 rib。

不允许 500 个复杂 Markdown Turn 长期全部挂载。

TurnItem 首次渲染后缓存真实高度。

离 viewport 足够远时：

```text
heavy TurnItem
-> exact-height placeholder
```

必须保留 heavy DOM：

- viewport 内 Turn。
- 上下 overscan。
- Streaming Turn。
- Keyboard focused Turn。
- 正在执行 Jump final snap 的 Turn。

Height Cache 由 `ResizeObserver` 更新。

目标 Turn 当前是 placeholder：

```text
scroll placeholder
-> target enters render window
-> mount TurnItem
-> final snap
```

这样 Navigator Jump 不要求目标 Markdown 一直挂在 DOM。

## 18. 状态所有权

`SessionWorkspace`：

- Session 生命周期。
- send / stop / streaming。
- model。
- follow output。

`useSessionMessageWindow`：

- 当前 Message Window。
- older / newer pagination。
- Target Window。
- Window request abort。

`useTurnNavigator`：

- Navigation Entry。
- Current / Visible。
- Hover / Focus / Drag。
- Jump Controller。
- Rail auto-follow。
- Keyboard。

`TurnNavigator`：

- JSX。
- Pointer / Keyboard event wiring。
- Preview。
- visual state。

禁止把 Session / Turn 状态放到 `shared/ui`。

## 19. 错误与清理

Navigation Index 失败：

```text
Session 正文继续可用
Navigator 不显示
```

Target Window 失败：

```text
原正文不动
原 Current 不动
Preview 提供 retry
```

Session 切换时必须取消：

- Navigation Index request。
- Target Window request。
- smooth jump。
- Drag listeners。

并清空：

- Current。
- Visible。
- Hover / Focus。
- rib layout。

不能短暂显示上一 Session Navigator。

## 20. 性能硬约束

```text
Scroll        -> requestAnimationFrame
Pointer Move  -> requestAnimationFrame
Fisheye       -> no React state per frame
Streaming     -> no Navigation Index rebuild per delta
Visible       -> IntersectionObserver
Layout        -> ResizeObserver
Identity      -> data, not MutationObserver
Preview       -> one instance
Heavy Turn DOM -> bounded
```

## 21. 测试

Pure helper：

```text
Navigation build
Current anchor
nearest rib
fisheye falloff
optimistic reconcile
```

TurnNavigator：

```text
3 Turn threshold
optimistic threshold
current / visible / focused
shared Preview
click
prev / next / origin / terminus
roving tabindex
keyboard
drag threshold
post-drag click suppression
reduced motion
```

SessionWorkspace integration：

```text
Navigation Index
Streaming does not steal history
loaded Turn jump
unloaded Turn target window
jump cancellation
jump latest
older / newer pagination
session switch cleanup
```

Long Session：

```text
500 Turn entries
all ribs reachable
heavy TurnItem bounded
far jump works
streaming tail stays mounted
only one Tab stop
```

最终执行：

```text
npm run check
```

## 22. 实现顺序

### PR1：Navigation Data Contract

```text
Turn Navigation Index
Target Message Window
Frontend SessionService types / parser
```

### PR2：Turn Render Boundary

```text
TurnRenderModel
TurnItem
useSessionMessageWindow
older / newer window
视觉保持不变
```

### PR3：Current Turn + Basic Navigator

```text
Reading Anchor
Visible Turn
Rail
Shared Preview
Click
Prev / Next / Origin / Terminus
```

### PR4：Drag + Fisheye + Accessibility

```text
unified rib layout
Drag
Fisheye
roving tabindex
Reduced Motion
Shift + Alt + M
```

### PR5：Streaming + History Jump

```text
Optimistic Entry
onStarted reconcile
unloaded target
jump cancellation
jump latest
Stop / Failure / Recovery
```

### PR6：Long Session + Acceptance

```text
Turn DOM Window
exact-height placeholder
500 Turn tests
PRD Acceptance
不继续新增功能
```

## 23. Done 条件

实现完成时必须满足：

- Navigator 完全以 Turn 数据驱动。
- Current Turn 使用固定 30% Reading Anchor。
- 所有跳转经过同一个 Scroll Controller。
- Hover / Preview / Click / Drag / Fisheye 共用 Rib Layout。
- 完整 Navigation Index 不加载全部 Message 正文。
- 未加载 Turn 只在最终 Jump 时加载目标附近 Message Window。
- Optimistic -> Persisted 不产生重复节点。
- Streaming 不抢用户历史阅读位置。
- Navigator Terminus 与现有 Scroll-to-Bottom 共用 Latest 语义。
- Keyboard 只有一个 Tab stop。
- 500 Turn 下 Heavy Markdown DOM 有明确上限。
- Turn Identity 不依赖 MutationObserver。
- 不新增全局状态框架和前端虚拟列表依赖。
