# History

Status: Implementing
Domain: Conversation

Depends On:
- [Send Message](./send-message.md)

Related:
- [Streaming](./streaming.md)
- [Stop](./stop.md)
- [Reconnect](./reconnect.md)
- [Context](./context.md)
- [Turn Navigator](./turn-navigator.md)

Frontend:
- `yakable-ui/src/features/session/components/SessionWorkspace.tsx`
- `yakable-ui/src/features/session/components/MessageItem.tsx`
- `yakable-ui/src/service/session/SessionService.ts`

Backend:
- `yakable-boot/src/main/java/io/yakable/boot/controller/session/SessionController.java`
- `yakable-service/src/main/java/io/yakable/service/session/SessionService.java`
- `yakable-service/src/main/java/io/yakable/service/message/MessageService.java`

Data:
- Session
- Turn
- Message

Shared Rules:
- CONV-001
- CONV-009
- CONV-014
- CONV-016

Scenarios:
- CONV-S01
- CONV-S02
- CONV-S03
- CONV-S06
- CONV-S07

Tests:
- `yakable-ui/src/features/session/components/__tests__/SessionWorkspace.test.tsx`
- `yakable-ui/src/service/session/__tests__/SessionService.test.ts`
- `yakable-service/src/test/java/io/yakable/service/message/impl/MessageServiceImplTest.java`
- `yakable-boot/src/test/java/io/yakable/boot/controller/session/SessionControllerTest.java`

Implementation Design:
- GAP-05 不修改生产交互，只补 CONV-S06 的完整前端回归测试。
- 测试显式构造可滚动容器的 scrollTop / scrollHeight / clientHeight。
- 用户离开 latest 后触发 Streaming delta，断言 scrollTop 不变化，并显示 Scroll to bottom。
- 点击 Scroll to bottom 后，断言滚动到当前 scrollHeight，并恢复 follow output。
- 后续再增加 scrollHeight 并触发新的 Streaming delta，断言组件自动继续滚动到底部。
- 本次不修改 SessionWorkspace、SessionService、后端、API 或滚动算法。

## Purpose

稳定展示当前 Session 的历史 Message，并按需加载更早内容。

## Contract

- 初始 Session 只加载最近一页 Message。
- 当前页面大小默认 50。
- Session 增量 changes 单次返回保持有界，当前上限为 100 条 Message。
- 更早历史通过 beforeSequence 向上分页。
- prepend 更早历史后保持当前阅读位置。
- 初始进入 Session 默认定位最新内容。
- 用户离开 latest 阅读历史时，Streaming 不强制拉回底部；界面提供明确的回到最新位置入口。
- Message 按稳定 sequence 排序。
- Streaming / Stop / Failure 最终通过持久化 Message 收敛到 History。
- Session 切换时不能短暂显示上一 Session 历史。

## Flow

```text
enter Session
→ querySession
→ latest messages

scroll near top
→ queryMessages(beforeSequence, 50)
→ prepend
→ compensate scrollHeight
```

## Boundary

Owns:
- UI message history
- message ordering
- history paging
- persisted result convergence

Does Not Own:
- LLM Context selection
- full Turn navigation index
- search
