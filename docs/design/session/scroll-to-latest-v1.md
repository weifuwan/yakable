# Scroll to Latest Technical Design V1

> 对应 UX：`docs/ux/session/scroll-to-latest-v1.md`  
> 范围：Yakable UI / Session

## 1. 技术边界

该能力完全属于前端。

不新增：

- Backend API。
- Session / Turn / Message 字段。
- 全局 Store。
- 独立 Scroll Manager。
- 新的共享组件。

继续由 `SessionWorkspace` 持有消息区滚动状态。

## 2. 当前代码位置

```text
yakable-ui/src/features/session/components/
├── SessionWorkspace.tsx
└── __tests__/
    └── SessionWorkspace.test.tsx
```

共享按钮继续复用：

```text
shared/ui/IconButton
```

## 3. 状态

`scrollRef`

- 指向 Session 消息滚动容器。

`followOutputRef`

- 表示 Streaming 是否应该继续自动跟随最新内容。
- 不需要触发 React render，因此使用 ref。

`showScrollBottom`

- 只负责按钮是否显示。
- 属于用户可见状态，因此使用 React state。

## 4. 最新位置判断

V1 使用：

```text
scrollHeight - scrollTop - clientHeight <= 120px
```

作为“接近底部”。

120px 是交互容差，不是业务数据。

## 5. 状态流

### 用户滚动

```text
onScroll
↓
isNearBottom()
↓
followOutputRef = nearBottom
↓
showScrollBottom = !nearBottom
```

同时保留现有顶部历史加载判断。

### 新内容到达

Message、Optimistic Message 或 Streaming Content 变化后：

```text
followOutputRef = true
  → scrollToBottom()

followOutputRef = false
  → do nothing
```

### 点击按钮

```text
scrollToBottom()
├── followOutputRef = true
├── showScrollBottom = false
└── scrollTop = scrollHeight
```

## 6. 与 Streaming 的关系

Scroll 状态只控制浏览器是否跟随输出。

它不能：

- Stop Turn。
- 取消 Streaming。
- 修改 Turn 状态。
- 重新订阅 SSE。

因此：

```text
reading position
!=
execution state
```

## 7. 与 Turn Navigator 的关系

未来 Turn Navigator 的 “Latest / Terminus” 应复用同一个“回到最新位置”语义。

V1 不为了未来 Navigator 提前抽象新的 Controller。

只有出现第二个真实调用方后，再决定是否提取共享 Hook。

## 8. 测试

重点保护：

- 离开底部后显示按钮。
- 点击后滚到最新位置。
- 点击后按钮隐藏。
- 用户阅读历史时 Streaming 更新不修改 scrollTop。
- 回到底部后 Streaming 恢复自动跟随。
