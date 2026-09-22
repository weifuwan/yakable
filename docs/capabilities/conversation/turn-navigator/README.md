# Turn Navigator

> 状态：Draft / 尚未实现

## 能力

解决长 Session 中“很难快速定位之前某一轮”的问题。

导航单位是 Turn，不是 Message。

## 用户行为

桌面端长 Session 中提供右侧 Turn 导航：

- Current Turn。
- Hover / Prompt Preview。
- 点击跳转。
- Previous / Next。
- Drag-to-Scrub。
- Fisheye。
- Keyboard。
- 回到最早 / 最新位置。

窄屏 V1 隐藏 Navigator。

## 边界

Turn Navigator 只负责当前 Session 内的定位。

不负责：

- Session Search。
- 跨 Session 导航。
- Message 编辑。
- Streaming 执行。
- Context。

导航索引不能要求一次性加载全部 Message 正文。

## 核心设计

```text
Navigation Index
= 整个 Session 的轻量 Turn 索引

Message Window
= 当前正文真正加载的一段 Message
```

每个 Turn 最终需要一个稳定 DOM Anchor。

Current Turn 使用固定阅读锚点，而不是 Message 级切换。

所有 Click / Drag / Keyboard / Latest 应复用同一套 Turn Identity 和 Jump 语义。

500 Turn 下不能要求全部复杂 Markdown 常驻 DOM。

## 计划代码落点

Frontend：

```text
yakable-ui/src/features/session/components/
├── SessionWorkspace.tsx
├── TurnItem.tsx
└── turn-navigator/
    ├── TurnNavigator.tsx
    ├── useTurnNavigator.ts
    └── turn-navigation.ts
```

Backend 预计需要：

- 轻量 Turn Navigation Index。
- 按目标 sequence 加载 Message Window。

## 实现原则

先数据契约，再 Turn Render Boundary，再 Basic Navigator，再 Drag / Fisheye / Accessibility，最后处理长 Session。

不要为了 Navigator 引入新的全局状态框架。

## 测试

至少保护：

- 3 Turn 显示阈值。
- Current / Preview / Click。
- Drag。
- Keyboard。
- Streaming 不抢历史阅读。
- Optimistic → persisted 不重复节点。
- 未加载历史 Turn 跳转。
- 500 Turn。
