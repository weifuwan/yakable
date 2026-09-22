# Scroll to Latest Implementation Plan V1

> PRD：`docs/prd/session/session-v1.md`  
> UX：`docs/ux/session/scroll-to-latest-v1.md`  
> Design：`docs/design/session/scroll-to-latest-v1.md`

## 计划

这是一个纯前端小功能，只需要一个 PR。

```text
确认 SessionWorkspace 当前行为
→ 对照 Technical Design
→ 已满足则不重写生产代码
→ 补 Scroll + Streaming 回归测试
→ 对照 UX 验收
```

涉及：

```text
yakable-ui/src/features/session/components/
```

不涉及 Backend、数据库、API、Turn Navigator，也不为了该功能抽取新的 Hook 或组件。
