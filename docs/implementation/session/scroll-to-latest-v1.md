# Scroll to Latest Feature Implementation Spec V1

> Plan：`docs/plans/session/scroll-to-latest-v1.md`

## 1. 文件范围

生产代码：

```text
yakable-ui/src/features/session/components/SessionWorkspace.tsx
```

测试：

```text
yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx
```

不新增新的生产文件。

## 2. 现有实现入口

### 常量

```ts
SCROLL_BOTTOM_THRESHOLD_PX = 120
```

只用于判断用户是否仍然位于最新位置附近。

### isNearBottom

职责：

```text
读取 scrollHeight / scrollTop / clientHeight
→ 返回是否接近底部
```

不修改状态。

### handleScroll

职责：

```text
读取当前位置
→ 更新 followOutputRef
→ 更新 showScrollBottom
→ 接近顶部时触发历史加载
```

Scroll-to-Latest 与历史分页共享同一个 scroll event，但保持不同判断。

### scrollToBottom

职责：

```text
followOutputRef = true
showScrollBottom = false
scrollTop = scrollHeight
```

不处理 Turn、Message 或 Streaming 请求。

### 内容变化 Effect

监听：

- Session 切换。
- Message 数量。
- Optimistic Message。
- Streaming Content。

只有 `followOutputRef.current === true` 时调用 `scrollToBottom()`。

## 3. UI

按钮继续放在 Session 消息 viewport 底部中间：

```text
Message viewport
       │
       ▼
   [ ↓ / ... ]
```

复用 `IconButton`。

状态：

```text
idle       → down arrow
generating → three dots
```

两种视觉都调用同一个 `scrollToBottom`。

## 4. 状态所有权

```text
SessionWorkspace
├── scrollRef          DOM
├── followOutputRef    behavior state
└── showScrollBottom   render state
```

不要把这些状态移到：

- `shared/ui`。
- Project。
- SessionService。
- Backend。

## 5. 测试实现

### Case 1：离开最新位置并返回

准备可控 scroll metrics：

```text
scrollHeight = 1000
clientHeight = 400
scrollTop = 0
```

触发 scroll：

```text
not near bottom
→ Scroll to bottom button visible
```

点击按钮：

```text
scrollTop = scrollHeight
button hidden
```

### Case 2：历史阅读期间不抢位置

用户先滚离底部：

```text
followOutputRef = false
```

再触发一次正常 Streaming：

```text
optimistic / started / delta
→ content changes
→ content effect runs
→ scrollTop remains unchanged
```

证明 Streaming 不会强制回到底部。

## 6. File Change Plan

当前生产实现已经满足该 Feature Spec。

本次 MVP 不重写 `SessionWorkspace.tsx`，只做：

```text
ADD
docs/ux/session/scroll-to-latest-v1.md
docs/design/session/scroll-to-latest-v1.md
docs/plans/session/scroll-to-latest-v1.md
docs/implementation/session/scroll-to-latest-v1.md

MODIFY
docs/README.md
yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx
```

原则：

> 已经正确的生产代码不因为补文档而重构。
