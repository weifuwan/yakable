# Yakable Turn Navigator Frontend Design V1

> 状态：Draft  
> 版本：V1  
> 对应 PRD：`docs/prd/session/turn-navigator-v1.md`  
> 范围：Yakable UI / Session

## 1. 设计目标

Turn Navigator 解决长 Session 中“我现在在哪一轮、之前问过什么、怎样快速回去”的问题。

本设计只负责确定前端结构、状态、滚动模型、交互边界和所需数据契约。  
不改变 Session、Turn、Message 的业务语义，不引入 Agent、Search 或新的全局状态框架。

设计目标：

- Navigator 以 Turn 为单位，不以 Message 为单位。
- Navigator 数据由 Session 数据驱动，不通过扫描 DOM 反推业务数据。
- Current Turn、点击、Drag、Preview、键盘导航使用同一套 Turn Identity。
- Streaming、Optimistic、Stop、Failure 不产生重复导航节点。
- Navigator 可以覆盖完整 Session，但 Message 正文仍按需加载。
- 长 Session 不依赖所有 Markdown Message 同时存在于 DOM。
- 不新增全局 Store，不把 feature 状态放进 `shared/ui`。
- 不新增前端虚拟列表依赖，优先使用 Turn 级有界 DOM Window。

## 2. 当前实现与差距

当前 Session 页面已经具备：

- `SessionWorkspace` 负责 Session 加载、Streaming、Stop、历史分页和滚动。
- `scrollRef` 是唯一 Message 滚动容器。
- 初次只加载最近 50 条 Message。
- 向上接近顶部时继续加载更早 Message。
- `followOutputRef` 控制 Streaming 是否继续跟随底部。
- `optimisticMessage` 在 Turn 正式建立前即时展示 USER Prompt。
- `streamingMessage` 展示当前 Assistant Streaming 内容。
- `scrollToBottom` 和现有底部按钮负责返回最新内容。
- `querySession` 已返回当前 Session 的全部 Turn，但只返回最近 50 条 Message。

当前缺少：

- Turn 级 DOM 边界。
- 完整 Turn 对应的 USER Prompt 导航信息。
- Current Turn 判定。
- Turn 跳转控制器。
- 未加载历史 Turn 的目标跳转。
- 双向 Message Window。
- Navigator Rail / Preview / Drag / Fisheye / Keyboard。
- 长 Session 的有界重渲染机制。

最关键的数据缺口是：

```text
querySession
  ├── turns[]            -> 全部 Turn
  └── messages[]         -> 最近 50 条 Message
```

旧 Turn 虽然存在于 `turns[]`，但它对应的 USER Prompt 已不一定存在于当前 `messages[]`。  
因此前端不能仅靠当前 `SessionSnapshot` 构建完整 Prompt Navigator。

## 3. 总体结构

Turn Navigator 保持在 `session` feature 内。

```text
SessionWorkspace
├── useSessionMessageWindow
├── useTurnNavigator
├── Session message viewport
│   └── TurnItem
│       ├── USER MessageItem
│       ├── ASSISTANT MessageItem
│       └── Turn local state
└── TurnNavigator
    ├── origin
    ├── scrollable rib column
    ├── terminus
    └── shared Prompt Preview
```

建议文件：

```text
yakable-ui/src/features/session/
├── components/
│   ├── SessionWorkspace.tsx
│   ├── MessageItem.tsx
│   ├── TurnItem.tsx
│   └── turn-navigator/
│       ├── TurnNavigator.tsx
│       ├── useTurnNavigator.ts
│       ├── turn-navigation.ts
│       └── __tests__/
└── hooks/
    └── useSessionMessageWindow.ts
```

不拆 `TurnNavigatorItem`、`TurnNavigatorPreview` 等只有少量 JSX 的组件。  
只有当实现确实出现独立职责时再继续拆分。

## 4. 核心设计原则

### 4.1 Navigator 由数据驱动

禁止把 DOM 当作 Navigator 的数据源。

不要：

```text
querySelectorAll(message)
-> 猜 Turn
-> 抓 textContent
-> 生成导航
```

应当：

```text
Session navigation data
        +
optimistic Turn
        ↓
TurnNavigationEntry[]
        ↓
TurnNavigator
```

DOM 只负责：

- 当前可视位置。
- Turn 几何位置。
- Scroll target。
- Focus target。

这样 Streaming 时即使 Message DOM 变化，Navigator Identity 也不依赖 DOM id。

### 4.2 Turn 是唯一导航单位

Message 继续负责内容展示，TurnItem 负责一轮对话的 DOM 边界。

```text
TurnItem
├── USER Message
├── ASSISTANT Message
├── Thinking
└── Failure / partial state
```

每个 TurnItem 必须有稳定 Turn Anchor：

```text
data-turn-id
data-turn-key
```

正式 Turn 使用 `turnId`。  
临时 Turn 使用 `optimistic:<requestId>`。

### 4.3 Navigation Index 与 Message Window 分离

完整 Navigator 和当前正文不是同一份数据。

```text
Navigation Index
= 整个 Session 的轻量 Turn 索引

Message Window
= 当前正文真正需要展示的一段 Message
```

Navigator 不要求加载全部 Markdown。  
Message Window 也不决定 Navigator 是否知道一个 Turn 的存在。

## 5. Frontend 数据模型

### 5.1 TurnNavigationEntry

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

字段语义：

- `key`：当前页面生命周期内稳定的 UI Identity。
- `turnId`：正式 Turn ID；Optimistic 阶段为 null。
- `userMessageId`：正式 USER Message ID。
- `userMessageSequence`：用于定位历史 Message Window。
- `preview`：导航展示的 Prompt Preview。
- `persisted`：是否已经正式成立。

正式历史项默认：

```text
key = turn:<turnId>
```

发送新 Prompt 后：

```text
key = optimistic:<requestId>
```

收到 `onStarted` 后，不新增第二项，而是在原项上补齐：

```text
turnId
userMessageId
userMessageSequence
persisted = true
```

页面刷新后重新加载时，使用正式 `turn:<turnId>` 即可，不要求跨刷新保持原 client key。

### 5.2 TurnRenderModel

Message 展示不再直接平铺 `snapshot.messages.map(...)`，而是先按 Turn 聚合：

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

`Thinking...`、Turn Failure、Streaming Assistant 都进入对应 TurnItem。  
这样一个 Turn 的垂直范围才是完整且稳定的。

### 5.3 SessionMessageWindow

前端不再把“当前已经加载的 Message”理解成“从最旧已加载一直到最新的无限增长数组”。

```ts
interface SessionMessageWindow {
  messages: SessionMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  olderCursor: number | null;
  newerCursor: number | null;
}
```

进入 Session 时：

```text
latest window
hasNewer = false
```

跳转到很早的 Turn 时，可以切换为目标附近的 Message Window，而不需要把目标到最新位置之间的全部 Message 都下载和渲染出来。

## 6. 所需后端数据契约

Frontend Design 不规定 Java 内部实现，但当前 API 无法完整满足 PRD，需要两个轻量能力。

### 6.1 Turn Navigation Index

新增 Session 级轻量导航查询。

前端期望语义：

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

- 只返回已经正式成立的 Turn。
- 按 USER Message sequence 升序。
- 不返回 Assistant Message 正文。
- `preview` 由 USER Prompt 得到。
- Preview 在服务端完成空白收敛和长度限制，避免 500 个长 Prompt 形成大响应。
- 建议 Preview 最大 160 个 Unicode 字符。
- 权限边界与 Session 查询一致。

Turn 状态继续来自现有 `snapshot.turns`，不在 Navigation Index 重复维护动态状态。

### 6.2 Target Message Window

现有 `queryMessages(beforeSequence)` 只能向过去分页。  
它不适合从 Turn 500 直接跳到 Turn 50，因为前端只能连续向前请求直到目标出现。

需要一个按 USER Message sequence 定位的窗口查询：

```text
SessionService.queryMessageWindow(
  projectId,
  sessionId,
  anchorSequence,
  before,
  after
)
```

返回一段连续 Message，以及：

```ts
interface SessionMessageWindowResult {
  messages: SessionMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  olderCursor: number | null;
  newerCursor: number | null;
}
```

推荐默认：

```text
before = 24
after = 25
```

目标 USER Message 必须包含在返回窗口中。

这个契约的目的不是替代所有历史分页，而是让“跳到未加载 Turn”只加载目标附近必要正文。

## 7. Message Window 行为

### 7.1 初始进入

仍使用当前 Session 初始请求：

```text
最近 50 条 Message
```

转换为：

```text
hasOlder = current hasMoreMessages
hasNewer = false
```

Session 默认滚到最新位置。

### 7.2 向上阅读

接近窗口顶部：

```text
query older
-> prepend
-> 保持当前视觉锚点
```

保留现有“prepend 后补偿 scrollHeight 差值”的思路。

### 7.3 从历史窗口向下阅读

如果 `hasNewer = true`，接近当前窗口底部时加载下一段较新的 Message。

只有真正到达最新 Message Window 后：

```text
hasNewer = false
```

此时才恢复普通最新内容语义。

### 7.4 Jump 到未加载 Turn

流程：

```text
Navigator target
    ↓
target Turn 已在 DOM？
 ├─ yes -> 直接 scroll
 └─ no
      ↓
queryMessageWindow(targetSequence)
      ↓
替换当前 active Message Window
      ↓
render
      ↓
scroll target Turn
```

目标加载期间：

- Navigator 保持用户选择的目标。
- Shared Preview 显示 loading 状态。
- Session 现有正文不立即清空。
- 请求成功后再切换 Window。
- 请求失败时保留原阅读位置并允许重试。

新的 Jump 到来时必须取消旧 Jump。

## 8. TurnItem DOM Boundary

TurnItem 是 Current Turn、Focus 和长 Session Windowing 的基础。

建议结构：

```tsx
<section
  data-turn-id={turnId}
  data-turn-key={key}
  tabIndex={-1}
>
  ...
</section>
```

规则：

- 一个 Turn 只有一个顶层 TurnItem。
- USER / ASSISTANT / Thinking / Failure 都在同一 TurnItem 内。
- TurnItem 不负责导航逻辑。
- TurnItem 可以被程序化 focus。
- 普通鼠标点击不会留下多余 focus ring。
- Navigator 跳转后，键盘用户可以把焦点落到 TurnItem。

## 9. Current Turn

### 9.1 固定阅读锚点

V1 使用消息滚动容器顶部向下 **30%** 的位置作为 Reading Anchor。

```text
scroll viewport

0%   ─────────────
        ...
30%  ── anchor ──
        ...
100% ─────────────
```

Current Turn 规则：

- anchor 落在某个 TurnItem 垂直范围内：该 Turn 为 Current。
- anchor 落在 Turn 间空白：取 anchor 上方最近 Turn。
- scrollTop = 0：最早已显示 Turn。
- 到达 Session 真正底部：最新 Turn。
- 只允许一个 Current Turn。

### 9.2 Visible Turn

Visible Turn 与 Current Turn 分开。

使用 `IntersectionObserver` 维护当前和 Message viewport 相交的 Turn set，只用于：

- 次一级高亮。
- 辅助 Navigator 状态。

Current Turn 不直接依赖 IntersectionObserver 回调顺序。

### 9.3 几何更新

使用：

```text
scroll -> requestAnimationFrame -> Current Turn calculation
ResizeObserver -> invalidate Turn layout
```

Markdown、代码块、图片或 Streaming 导致高度变化时，通过 ResizeObserver 刷新 Turn 几何。

V1 不使用 MutationObserver 追踪 Message Identity。  
Identity 来自数据，DOM 内容变化只属于 layout 问题。

## 10. Scroll Controller

所有 Turn 跳转必须走同一个 scroll controller。

不要分别在：

- rib click
- Preview click
- previous
- next
- keyboard
- drag release

各写一套 `scrollIntoView`。

统一：

```text
jumpToTurn(turnKey, mode)
```

### 10.1 已加载 Turn

读取 TurnItem 和 scroll container 的实时几何位置。

目标位置：

```text
Turn top
- 固定顶部安全间距
```

平滑滚动期间每帧重新读取目标相对位置，避免 Markdown 或 Streaming 在滚动中改变高度导致最终落点偏移。

使用单一 scroll token：

```text
new jump
-> invalidate previous jump
```

连续快速点击时只有最后一个目标有效。

### 10.2 Reduced Motion

`prefers-reduced-motion: reduce` 时：

- Turn 跳转直接定位。
- Fisheye 不做连续放大动画。
- Preview 和键盘功能正常保留。

### 10.3 回到最新位置

现有 `scrollToBottom` 改为共享的：

```text
jumpToLatest()
```

如果当前 Message Window 不是最新 Window：

```text
load latest window
-> render
-> scroll bottom
```

如果已经是最新 Window：

```text
scroll current container bottom
```

无论来自：

- 现有底部按钮。
- Navigator terminus。

最终都必须：

```text
followOutputRef = true
currentTurn = latest
```

## 11. Navigator Rail

TurnNavigator 是 Message scroll container 的绝对定位 sibling，不放到 Message 正文内部。

```text
relative workspace body
├── message scroll container
└── absolute TurnNavigator
```

这样：

- Rail 不参与正文布局。
- Preview 不被正文 overflow 裁剪。
- Message 滚动不会直接移动 Rail。

桌面端满足 PRD 阈值时显示；窄屏隐藏。

### 11.1 Rail 结构

```text
origin button
    ↓
scrollable rib column
    ↓
terminus button
```

Origin 和 Terminus 固定，不进入 rib column 的滚动内容。

长 Session 时：

- rib column 自己可以滚动。
- 隐藏视觉 scrollbar。
- 自动保持 Current Turn 附近 rib 可见。
- Pointer / Focus / Drag 正在操作 Rail 时暂停自动居中。
- 用户可以用滚轮浏览远处 rib。

### 11.2 Rib 状态

每个 Turn rib 有四种视觉状态：

```text
dim
visible
current
focused
```

优先级：

```text
focused > current > visible > dim
```

Current 在静止状态下已经比普通 rib 更长。  
Fisheye 是额外的交互放大，不负责表达 Current。

## 12. Shared Prompt Preview

整个 Navigator 只有一个 Preview。

触发源：

- pointer hover。
- keyboard focus。
- Drag 当前目标。

优先级：

```text
drag target
> keyboard focused target
> pointer hovered target
```

Preview：

- 展示单个 Prompt。
- 文本直接来自 Navigation Entry。
- 不读取 TurnItem DOM textContent。
- Prompt 内换行折叠为空格。
- 过长内容省略。
- 点击 Preview 调用同一个 `jumpToTurn`。
- 首次打开可以有很短延迟，已经打开后切换 Turn 应即时更新。
- 不为每个 rib 创建独立 HoverCard。

## 13. Fisheye

Fisheye 只发生在 Rail 自己的 DOM。

性能热路径不进入 React state：

```text
pointermove
-> requestAnimationFrame
-> read cached rib centers
-> calculate falloff
-> write rib width / height
```

使用余弦衰减：

```text
pointer 最近 rib  = peak
附近 rib          = partial
超出影响半径      = base
```

所有 rib 使用固定 row height。  
只改变横向长度和线条厚度，不改变每个 rib 行在垂直方向占用的高度。

因此 Fisheye 不会：

- 推动下面的 rib。
- 改变 hit target 顺序。
- 导致 pointer 下的目标自己移动。

## 14. Drag-to-Scrub

### 14.1 Pointer 状态

`pointerdown` 后记录：

```text
pointerId
startX
startY
```

移动距离未超过 4px：

```text
仍按 click 候选处理
```

超过 4px：

```text
进入 dragging
```

Drag 结束后抑制浏览器紧随其后的 synthetic click。

Pointer move / up / cancel 使用 document 级监听，避免指针离开细 Rail 后丢失 Drag。

### 14.2 统一 Rib Layout

Hover、Fisheye、Preview、Gap Click、Drag 必须读取同一个：

```ts
ribLayoutRef
```

每项包含：

```text
entry key
row center
base dimensions
```

Pointer 转成 rib column content-space：

```text
clientY
-> column rect
-> + column.scrollTop
-> nearest rib
```

禁止不同交互各自用一套比例或坐标系计算目标。

### 14.3 已加载 / 未加载目标

Drag 到已加载 Turn：

```text
可以即时正文跟随
```

Drag 到未加载 Turn：

```text
只更新 Preview 和 target
不发历史请求
```

Pointer release：

```text
只对最终 target 执行一次 jumpToTurn
```

## 15. Optimistic 与 Streaming

### 15.1 Optimistic Entry

Navigator 已经显示时，提交 Prompt 后立即 append：

```text
optimistic:<requestId>
```

Navigator 尚未达到 3 个 persisted Turn 时，不因为 Optimistic Entry 单独显示。

### 15.2 onStarted Reconcile

收到：

```text
turn
userMessage
```

后：

- 替换 Optimistic TurnRenderModel。
- 在同一 Navigation Entry 上补 turnId / messageId / sequence。
- 不 append 第二个 entry。
- 保持当前 rib 所在顺序。
- 不通过 Message 文本匹配去猜哪一个 optimistic item。

### 15.3 Streaming

Streaming 只更新对应 TurnItem 的 Assistant 内容。

禁止：

- 每个 delta rebuild Navigation Index。
- 每个 delta set Current Turn。
- 每个 delta 重新创建 rib list。

如果用户仍位于最新位置：

```text
follow output
current = latest
```

如果用户已经离开底部：

```text
Streaming 继续
正文不回拉
Rail 不回拉
```

## 16. Keyboard Accessibility

Navigator 只保留一个 Tab stop，采用 roving tabindex。

```text
current/focused rib -> tabIndex=0
other ribs          -> tabIndex=-1
```

键盘：

```text
ArrowUp / ArrowDown -> 移动一个 Turn
Home                 -> 最早 Turn
End                  -> 最新 Turn
Enter / Space        -> jump
```

跳转完成后：

```text
TurnItem.focus({ preventScroll: true })
```

使键盘用户从目标 Turn 继续阅读。

全局快捷键：

```text
Shift + Alt + M
```

只在 Navigator 当前真实可见且能够成功 focus 时调用 `preventDefault()`。  
Navigator 未显示时不吞掉按键。

## 17. 长 Session 与有界 DOM

500 个 Turn 时，允许存在 500 个轻量 Navigation Entry 和 500 个 rib。  
不允许 500 个复杂 Markdown Turn 长期全部保留为重 DOM。

### 17.1 Turn 级 Row Window

TurnItem 初次渲染后测量真实高度并缓存。

当 Turn 离当前 viewport 足够远时：

```text
heavy TurnItem
-> exact-height placeholder
```

placeholder 保留：

- Turn key。
- 精确高度。
- Scroll geometry。

保留重 DOM 的范围：

- 当前 viewport。
- 上下 overscan。
- 当前 Streaming Turn。
- 当前 keyboard focus Turn。
- 正在执行导航落点校准的 Turn。

### 17.2 Height Cache

使用 `ResizeObserver` 更新已挂载 Turn 高度。

Window resize 或正文宽度变化时，旧高度可能失效：

```text
invalidate
-> 分批重新测量
```

Streaming tail 永远保持挂载，直到进入终态并离开 overscan。

### 17.3 Jump 到 Placeholder

目标 Turn 已加载但当前是 placeholder：

```text
scroll placeholder
-> Turn 进入 render window
-> mount heavy content
-> final snap
```

这样点击 Navigator 不要求目标复杂 Markdown 事先一直挂载。

## 18. Rail Auto Follow

Rail 有自己独立的 scroll state。

普通正文滚动：

```text
Current Turn changes
-> Rail 将 current rib 保持在可见中部附近
```

以下状态冻结自动居中：

- pointer 在 Rail 内。
- keyboard focus 在 Rail 内。
- dragging。
- 用户正在滚动 Rail。

交互结束后，再恢复自动跟随 Current Turn。

这样用户浏览远处 Navigator 时不会被正文 Streaming 或 Current 变化抢回。

## 19. 错误与恢复

Navigation Index 失败：

- 不阻塞 Session 正文。
- Navigator 暂不显示。
- Session 的发送、Streaming、历史分页继续可用。

Target Message Window 加载失败：

- 不切换现有 Message Window。
- 不改变当前正文位置。
- Preview 显示可重试状态。
- 后续点击同一 Turn 可以重新请求。

Session 切换：

- 取消 Navigation Index 请求。
- 取消 Target Window 请求。
- 取消正在执行的 smooth jump。
- 清空 rib layout / current / focused / drag 状态。
- 不短暂展示上一 Session Navigator。

## 20. 状态所有权

`SessionWorkspace` 继续拥有：

- Session 生命周期。
- send / stop / streaming。
- model selection。
- follow output。

`useSessionMessageWindow` 拥有：

- active Message Window。
- older / newer pagination。
- target window loading。
- window request cancellation。

`useTurnNavigator` 拥有：

- navigation entries。
- Current Turn。
- Visible Turns。
- focused / hovered / drag target。
- jump controller。
- Rail auto-follow。
- keyboard navigation。

`TurnNavigator` 只负责：

- Rail JSX。
- Preview JSX。
- pointer / keyboard event wiring。
- visual state。

不要把业务状态搬到 `shared/ui`。

## 21. 性能规则

- Scroll handler 不直接循环 setState。
- 高频 Scroll / Pointer path 统一通过 `requestAnimationFrame`。
- Fisheye 不通过 React state 驱动每一帧。
- Streaming delta 不重新构建完整 Navigation Entry 数组。
- Navigation Index 只在初始加载、新 Turn 建立或 Session 变化时改变。
- `IntersectionObserver` 只负责 visible set。
- `ResizeObserver` 只负责 layout invalidation。
- 不用 MutationObserver 维护 Turn Identity。
- Shared Preview 只有一个实例。
- Turn heavy DOM 数量必须被 Window 限制。

## 22. 测试设计

### 22.1 Pure helpers

覆盖：

- Navigation Entry 构建。
- Prompt Preview normalize。
- Current Turn anchor 计算。
- Rib nearest target。
- Fisheye falloff。
- Optimistic -> persisted reconcile。

### 22.2 TurnNavigator Component

覆盖：

- persisted Turn < 3 不显示。
- Optimistic 不触发首次显示。
- 已显示后 Optimistic 正常追加。
- Current / visible / focused visual state。
- Shared Preview。
- click jump。
- Previous / Next / Origin / Terminus。
- roving tabindex。
- Arrow / Home / End / Enter / Space。
- Shift + Alt + M 条件处理。
- Drag threshold。
- post-drag click suppression。
- reduced motion。
- 长 rib column。

### 22.3 SessionWorkspace Integration

覆盖：

- query Navigation Index。
- Optimistic Entry 与 onStarted reconcile。
- Streaming 不抢历史阅读位置。
- target Turn 已加载直接跳转。
- target Turn 未加载只在最终选择时 query window。
- target window failure 保持当前正文。
- jumpToLatest 从历史 window 返回最新 window。
- older / newer pagination。
- Session 切换清理旧 Navigator。

### 22.4 Long Session

构造至少 500 个 Turn：

- Navigator 仍能访问全部 entry。
- Heavy TurnItem 数量保持在 Window 上限附近。
- Jump 到远处 Turn 可完成。
- Streaming tail 保持挂载。
- Rail keyboard 不产生 500 个 Tab stop。

前端最终必须通过：

```text
npm run check
```

## 23. 实现顺序

建议按依赖拆成 6 个 PR。

### PR1：Navigation Data Contract

- Turn Navigation Index。
- Target Message Window。
- Frontend SessionService types / parser。
- 不改 UI。

### PR2：Turn Render Boundary

- Message 按 Turn 聚合。
- TurnItem。
- useSessionMessageWindow。
- 双向窗口基础。
- 保持现有视觉不变。

### PR3：Current Turn + Basic Navigator

- useTurnNavigator。
- Reading Anchor。
- Visible Turn。
- rib rail。
- click jump。
- Previous / Next / Origin / Terminus。
- Shared Preview。

### PR4：Drag + Fisheye + Accessibility

- unified rib layout。
- Drag-to-Scrub。
- Fisheye。
- keyboard / roving tabindex。
- reduced motion。
- Shift + Alt + M。

### PR5：Streaming + History Jump

- Optimistic Navigation Entry。
- onStarted reconcile。
- unloaded target jump。
- target request cancellation。
- latest Window / follow output 收口。
- failure / stop / recovery 边界。

### PR6：Long Session Windowing + Acceptance

- Turn heavy DOM window。
- exact-height placeholder。
- 500 Turn tests。
- 全量 PRD Acceptance。
- 只修验收发现的问题，不继续扩功能。

## 24. Done 条件

Frontend Design V1 完成后的实现必须满足：

- Navigator 完全以 Turn 数据驱动。
- Current Turn 有唯一且稳定的 Reading Anchor 规则。
- 所有跳转经过同一 scroll controller。
- Hover、Preview、Fisheye、Click、Drag 使用同一 rib layout。
- 完整 Navigation Index 不要求加载全部 Message 正文。
- 未加载历史只在最终 jump 时加载目标附近 Message Window。
- Optimistic -> persisted 不产生重复 Turn。
- Streaming 不抢用户历史阅读位置。
- Navigator 和现有 Scroll-to-Bottom 共用 latest 语义。
- Keyboard 可完整操作且只有一个 Tab stop。
- 500 Turn 下 heavy Markdown DOM 有明确上限。
- 不依赖 MutationObserver 维持 Turn Identity。
- 不引入新的全局状态框架和前端虚拟列表依赖。
