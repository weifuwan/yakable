# Scroll to Latest Technical Design V1

> UX：`docs/ux/session/scroll-to-latest-v1.md`

## 技术边界

该能力完全属于前端，继续由 `SessionWorkspace` 管理。

不新增 Backend API、全局 Store、Scroll Manager 或新的共享组件。

## 代码位置

```text
yakable-ui/src/features/session/components/
├── SessionWorkspace.tsx
└── __tests__/SessionWorkspace.test.tsx
```

按钮继续复用 `shared/ui/IconButton`。

## 状态

```text
scrollRef
  → 消息滚动容器

followOutputRef
  → 是否自动跟随新内容

showScrollBottom
  → 是否渲染按钮
```

最新位置继续使用现有判断：

```text
scrollHeight - scrollTop - clientHeight <= 120px
```

## 状态流

用户滚动：

```text
onScroll
→ isNearBottom
→ followOutputRef = nearBottom
→ showScrollBottom = !nearBottom
```

内容变化：

```text
followOutputRef = true  → scrollToBottom()
followOutputRef = false → 保持当前位置
```

点击按钮：

```text
followOutputRef = true
showScrollBottom = false
scrollTop = scrollHeight
```

Scroll 状态只控制阅读位置，不能 Stop Turn、取消 Streaming 或修改任何业务状态。

## 演进边界

未来 Turn Navigator 的 Latest / Terminus 可以复用这套“回到最新位置”语义。

V1 不提前抽取 Hook；出现第二个真实调用方后再决定。

## 测试

保护一个完整场景：

```text
离开 latest
→ 按钮出现
→ Streaming 到达但不抢位置
→ 点击按钮
→ 回到 latest
→ 按钮隐藏
```
