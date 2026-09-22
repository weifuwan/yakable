# Scroll to Latest Feature Implementation Spec V1

> Plan：`docs/plans/session/scroll-to-latest-v1.md`

## 文件

```text
Production
yakable-ui/src/features/session/components/SessionWorkspace.tsx

Test
yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx
```

不新增生产文件。

## 实现逻辑

### isNearBottom

只负责计算：

```text
scrollHeight - scrollTop - clientHeight <= 120px
```

不修改状态。

### handleScroll

```text
读取当前位置
→ 更新 followOutputRef
→ 更新 showScrollBottom
→ 接近顶部时继续处理历史分页
```

### scrollToBottom

```text
followOutputRef = true
showScrollBottom = false
scrollTop = scrollHeight
```

不处理 Turn、Message 或 SSE。

### 内容变化

Message、Optimistic Message 或 Streaming Content 更新后：

```text
followOutputRef = true
→ scrollToBottom

followOutputRef = false
→ 不修改 scrollTop
```

因此用户阅读历史时，Streaming 只能更新内容，不能抢阅读位置。

## UI

继续在消息 viewport 底部中间使用现有 `IconButton`：

```text
idle       → down arrow
generating → three dots
```

两种状态调用同一个 `scrollToBottom`。

## 状态所有权

```text
SessionWorkspace
├── scrollRef
├── followOutputRef
└── showScrollBottom
```

这些状态不进入 `shared/ui`、SessionService 或 Backend。

## 测试

一个集成场景即可覆盖核心契约：

```text
scrollHeight = 1000
clientHeight = 400
scrollTop = 0

fire scroll
→ button visible

start Streaming
→ delta arrives
→ scrollTop still 0

click button
→ scrollTop = 1000
→ button hidden
```

## 本次实际改动

当前生产代码已经符合本 Spec，因此不重写 `SessionWorkspace.tsx`。

本次只新增四层文档、更新 `docs/README.md`，并补对应回归测试。

原则：**已有正确实现不因为补文档而重构。**
