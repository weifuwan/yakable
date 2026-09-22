# Scroll to Latest UX V1

> 产品规则来源：`docs/prd/session/session-v1.md`  
> 范围：Session 消息区

## 1. 目标

当用户离开最新消息去阅读历史内容时，Session 提供一个明确的“回到最新位置”入口。

该入口只解决阅读位置恢复，不改变 Session、Turn、Message 或 Streaming 的业务语义。

## 2. 页面状态

### 位于最新位置

- 不显示回到底部按钮。
- 新的 Streaming 内容继续自动跟随。

### 离开最新位置

- 在消息区底部中间显示一个浮动按钮。
- 用户当前阅读位置保持不变。
- 新的 Streaming 内容不能强制把页面拉回底部。

### 正在生成

按钮仍然表示“回到最新位置”。

视觉上可以使用正在生成状态，但不能改变按钮行为。

### Session Loading

Session 尚未加载完成时不显示按钮。

## 3. 用户操作

用户向上滚动并离开最新位置后，按钮出现。

用户点击按钮后：

```text
跳到最新消息
↓
按钮隐藏
↓
恢复自动跟随 Streaming
```

用户再次向上滚动后，重新退出自动跟随状态。

## 4. Streaming

如果用户仍在最新位置：

```text
new content
→ keep following
```

如果用户已经阅读历史：

```text
new content
→ keep current reading position
→ keep Scroll to Latest visible
```

Streaming 不能抢夺用户阅读位置。

## 5. 历史加载

向上加载更早 Message 时，现有阅读位置应保持稳定。

Scroll to Latest 与“加载更早历史”是两个独立交互：

- 顶部负责加载历史。
- 底部入口负责回到最新位置。

## 6. 可访问性

按钮必须具有明确的无障碍名称。

V1 继续使用：

```text
Scroll to bottom
```

按钮必须可以通过键盘聚焦和触发。

## 7. 验收

- 用户位于最新位置时按钮隐藏。
- 用户离开最新位置后按钮出现。
- 点击后到达最新位置并隐藏按钮。
- 点击后恢复 Streaming 自动跟随。
- 用户阅读历史时 Streaming 不强制滚到底部。
- Session Loading 时不显示按钮。
