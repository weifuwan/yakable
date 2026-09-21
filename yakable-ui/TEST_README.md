# Yakable 前端测试规范

测试的目标是保护稳定、可观察的产品行为，并让后续重构更安全。

测试不是为了给每个文件补覆盖率，也不是为了验证代码“怎么写”。

## 1. 什么时候应该写测试

以下场景应优先补充或更新测试：

- 用户操作会引起可观察的 UI 或状态变化。
- 存在 Loading、Success、Error、Empty 等真实可达状态。
- 涉及路由跳转、项目创建、会话切换等关键流程。
- 涉及 Prompt 提交、编辑、停止生成、流式响应等核心会话行为。
- 涉及 Enter、Shift+Enter、IME 等键盘输入行为。
- 业务逻辑具有明确、稳定的输入输出。
- 修复了一个值得长期防止回归的 Bug。

## 2. 什么时候不应该写测试

不要为了覆盖率、文件数量或实现细节机械增加测试。

以下内容默认不作为单元测试契约：

- Tailwind class、CSS class。
- 颜色、背景、圆角、阴影。
- padding、margin、宽高等纯视觉尺寸。
- 图标 path、Skeleton 的具体尺寸。
- React state、ref、effect、内部 DOM 结构。
- 仅验证“组件能成功渲染”的低价值测试。

纯视觉调整优先通过真实页面 Review、前端规范、Lint 或 Harness 保证。

## 3. 测试边界

使用能够证明目标行为的最小测试边界。

### Component / Feature

组件和功能测试只关注用户可观察的行为。

- 通过用户输入、点击、键盘操作驱动状态变化。
- 可以 Mock Service。
- 不直接测试 HTTP、SSE 等底层协议细节。

### Service

Service 测试负责数据和协议边界。

- 请求 URL、参数、Body。
- HTTP 成功与失败处理。
- SSE 的 started、delta、complete 等事件解析。
- Service 测试可以 Mock fetch。

### Utility

纯函数和通用工具只测试明确的输入输出，不为简单透传代码补测试。

## 4. 查询与用户交互

优先使用语义化查询：

1. `getByRole`
2. `getByLabelText`
3. `getByText` / `getByPlaceholderText`
4. `getByTestId`

只有没有合理 DOM 语义时才使用 `data-testid`。

用户交互优先使用 `userEvent`。只有需要验证底层事件本身时，才使用 `fireEvent`，例如 scroll、composition 等特殊事件。

## 5. Mock 规范

只 Mock 测试边界之外的依赖。

- 组件测试优先 Mock Service。
- Service 测试 Mock Network。
- 不要为了方便测试，把被测试行为的核心子组件全部 Mock 掉。
- 测试禁止访问真实网络。

Mock 必须保持生产代码真实使用的公开契约。

## 6. 异步与稳定性

测试必须可重复、可预测。

- 异步出现使用 `findBy*`。
- 异步状态变化使用 `waitFor`。
- 不使用固定 `sleep` 等待 UI。
- 只有时间本身是业务契约时才使用 fake timer。
- 不依赖真实时间、随机值或真实网络。

## 7. 测试文件与位置

当前 Yakable 前端统一使用：

- Vitest
- happy-dom
- React Testing Library

测试文件使用 `*.test.ts` 或 `*.test.tsx`。

新的 Component、Feature、Service 测试统一放在所属模块的 `__tests__/` 目录中，测试跟随行为拥有者，不集中堆放到全局测试目录。

跨多个 Feature 的集成测试统一放在 `src/__tests__/`。

纯 Utility 测试可以与源码同级放置，保持简单即可。

现有同级测试不要求为了目录规范一次性迁移；后续修改或重构对应模块时再逐步整理。

现阶段不额外引入 Browser Test、Playwright 或 E2E 测试体系，只有现有测试能力无法证明关键用户行为时再讨论升级。

## 8. 执行命令

运行全部前端测试：

```bash
npm run test
```

监听模式：

```bash
npm run test:watch
```

提交前运行完整检查：

```bash
npm run check
```
