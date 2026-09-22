# Turn Navigator

Status: Designing
Domain: Conversation

Depends On:
- [History](./history.md)
- [Streaming](./streaming.md)

Related:
- [Send Message](./send-message.md)
- [Reconnect](./reconnect.md)
- [Stop](./stop.md)

Frontend:
- Planned: `yakable-ui/src/features/session/components/TurnItem.tsx`
- Planned: `yakable-ui/src/features/session/components/turn-navigator/TurnNavigator.tsx`
- Planned: `yakable-ui/src/features/session/components/turn-navigator/useTurnNavigator.ts`
- Planned: `yakable-ui/src/features/session/components/turn-navigator/turn-navigation.ts`
- Existing host: `yakable-ui/src/features/session/components/SessionWorkspace.tsx`

Backend:
- Planned: lightweight Turn Navigation Index in Session API
- Planned: target Message Window by anchor sequence
- Existing host: `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- Existing host: `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`

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
- Planned: TurnNavigator component tests
- Planned: SessionWorkspace navigation integration tests
- Planned: 500 Turn long-session test

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

Design must be reviewed against current SessionWorkspace before implementation starts.
