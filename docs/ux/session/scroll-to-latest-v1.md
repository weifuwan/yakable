# Scroll to Latest UX V1

> 产品规则来源：`docs/prd/session/session-v1.md`

## 目标

用户离开最新消息去阅读历史时，提供一个明确的“回到最新位置”入口，同时不能让新的 Streaming 抢走当前阅读位置。

## 状态

### Latest

- 按钮隐藏。
- 新内容继续自动跟随。

### Reading History

- 消息区底部中间显示浮动按钮。
- 当前阅读位置保持不变。
- 新的 Streaming 内容不自动拉回底部。

### Generating

按钮仍然表示“回到最新位置”，可以使用生成中的视觉状态，但行为不变。

### Loading

Session 尚未加载完成时不显示按钮。

## 交互

```text
用户向上滚动
→ 离开 latest
→ 按钮出现

点击按钮
→ 到达最新消息
→ 按钮隐藏
→ 恢复 Streaming 自动跟随
```

向上加载更早 Message 与回到最新位置互不影响。

## 验收

- Latest 时按钮隐藏。
- 离开 Latest 后按钮出现。
- 点击后到达最新位置并隐藏。
- 点击后恢复 Streaming 自动跟随。
- 阅读历史时 Streaming 不强制回底部。
- 按钮支持键盘操作并具有明确无障碍名称。
