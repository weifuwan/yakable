# Frontend Test Rules

Scope:
- `yakable-ui/src/**/*.test.ts`
- `yakable-ui/src/**/*.test.tsx`
- 需要前端回归证据的产品行为

Depends On:
- `./FRONTEND_RULES.md`
- 被测试 owner 最近的 RULES

Owns:
- 用户可观察行为验证
- Frontend Service 协议验证
- 稳定纯函数验证

Runtime:
- Vitest
- happy-dom
- React Testing Library

## When Tests Are Required

优先为以下行为增加或更新测试：

- 用户操作导致可观察 UI / 状态变化。
- Loading / Success / Error / Empty 等真实状态。
- 路由跳转、项目创建、会话切换等关键流程。
- Prompt 提交、编辑、停止、Streaming、Reconnect 等核心会话行为。
- Enter / Shift+Enter / IME 等键盘输入行为。
- 有明确稳定输入输出的业务逻辑。
- 值得长期防回归的 Bug。

默认不为以下内容机械补测试：

- Tailwind / CSS class。
- 颜色、背景、圆角、阴影。
- padding、margin、宽高。
- Icon path、Skeleton 具体尺寸。
- React state、ref、effect、内部 DOM 结构。
- “组件能渲染”这类低价值断言。
- 单纯为了覆盖率数字。

## Test Boundary

### Component / Feature

- 通过用户输入、点击、键盘操作驱动行为。
- 只断言用户可观察结果。
- 可以 Mock Service。
- 不直接验证 HTTP / SSE framing。

### Service

- Mock network。
- 验证 URL、参数、Body。
- 验证 HTTP 成功 / 失败处理。
- 验证 SSE started / snapshot / delta / complete / stopped / error 等业务事件。

### Utility

- 只测试稳定输入输出。
- 简单透传函数不机械补测试。

## Query / Interaction

语义查询优先级：

```text
getByRole
→ getByLabelText
→ getByText / getByPlaceholderText
→ getByTestId
```

- 没有合理 DOM 语义时才使用 `data-testid`。
- 用户交互优先 `userEvent`。
- 只有 scroll、composition 等底层事件才使用 `fireEvent`。

## Mock Rules

Must:
- 只 Mock 被测试 owner 边界之外的依赖。
- Mock 保持生产代码真实公开 Contract。

Must Not:
- 访问真实网络。
- 为方便测试 Mock 掉被测试行为的核心子组件。
- Mock 被测试行为本身。

## Async / Stability

- 异步出现使用 `findBy*`。
- 异步状态变化使用 `waitFor`。
- 不用固定 sleep 等待 UI。
- 只有“时间本身就是 Contract”时才使用 fake timer。
- 不依赖真实时间、随机值或真实网络。
- 测试必须可重复、可独立执行。

## Location

新的 Component / Feature / Service 测试放在 owner 的 `__tests__/`。

跨多个 Feature 的集成测试放 `src/__tests__/`。

纯 Utility Test 可以与源码同级。

测试文件使用：

```text
*.test.ts
*.test.tsx
```

## Non-Goals

当前不引入：

```text
Coverage Threshold
Browser Test
Playwright / E2E
Visual Regression
Storybook Test
```

只有现有 Vitest / happy-dom 无法证明关键产品行为时，才升级测试层级。

## Execution

```bash
cd yakable-ui
npm run test
npm run test:watch
npm run check
```

`npm run check` 是提交前完整前端检查的一部分。
