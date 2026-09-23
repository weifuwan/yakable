# History

Status: Review
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
- `yakable-ui/src/features/session/hooks/useSessionMessageWindow.ts`
- `yakable-ui/src/features/session/hooks/useTurnWindowing.ts`
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

Review Notes:
- GAP-05 已完成代码侧补强：生产行为未修改，只新增 CONV-S06 的前端回归测试。
- 测试显式构造 scrollTop / scrollHeight / clientHeight，保护离开 latest 后 Streaming delta 不改变阅读位置。
- 测试保护 Scroll to bottom 出现，点击后回到最新位置并恢复 follow output。
- 测试再次增加 scrollHeight 并发送新的 Streaming delta，保护恢复 follow 后会继续自动滚到底部。
- SessionWorkspace、SessionService、后端、API 和滚动算法均未修改。
- 当前执行环境无法解析 github.com，目标 Vitest 尚未实际执行；测试通过前保持 Review。

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
- 回到最新位置必须恢复 latest Message page，不能只滚动当前历史 Message Window 的底部。
- 历史窗口与 Session latest sequence 分离；后台增量可以推进 Session 进度，但不能把无关最新 Message 注入当前历史窗口。
- Message 按稳定 sequence 排序。
- Streaming / Stop / Failure 最终通过持久化 Message 收敛到 History。
- 长历史允许卸载远处 Heavy Message DOM，但必须保留 exact-height Turn placeholder 与导航 Anchor。
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
