# Frontend Rules

Scope:
- `yakable-ui/src/**`
- Yakable 浏览器端生产代码

Depends On:
- `./ARCHITECTURE.md`
- 行为变化时加载 `./TEST_RULES.md`
- 后端接口变化时加载 `./SERVICE_RULES.md`

Related:
- `./docs/tooling.md`

Owns:
- 前端全局编码约束
- React / TypeScript 生产代码边界
- 浏览器交互基础规则

## Must

- 代码按 ownership 放置，依赖方向遵循 `ARCHITECTURE.md`。
- Page 只组合产品能力；Feature 拥有产品能力；Shared 只放无业务 owner 的复用能力。
- 优先使用原生 HTML 语义，并保留键盘、焦点和 disabled 行为。
- 所有支持鼠标点击的交互元素必须有明确 pointer cursor；Tailwind 使用 `cursor-pointer`。
- URL 已经表达的路由状态直接以 URL 为事实来源，不重复维护一份全局 selected state。
- 浏览器端只展示真实后端状态，不伪造 Assistant、Project 或其他服务端业务结果。
- React state 放在拥有该行为的最小边界，不为了共享方便提前上全局状态。
- Effect 只处理外部同步 / 生命周期，不用大段同步 `setState` 模拟组件重置；稳定身份变化优先通过组件边界、key 或明确事件处理。
- Render 期间不写 ref；ref 同步放在 effect 或事件边界。
- Oxlint / TypeScript / Oxfmt 已覆盖的问题按工具规则修复，不用宽泛 disable 绕过。
- 修改完成后至少运行与改动匹配的验证；提交前完整验证使用 `npm run check` 和 `npm run build`。

## Must Not

- 违反 `app → pages → features → service/shared` 的依赖方向。
- 在 Page / Component / Hook 直接调用 `fetch`。
- 为简单前端调用增加 interface / impl / adapter 等 Java 风格层级。
- 在 Shared 引入 Project、Session、Model、Agent 等产品业务语义。
- 为未来能力预创建空 Feature、状态层或菜单入口。
- 用 broad lint disable、关闭 warning 或跳过 formatter 让检查变绿。
- 把 Tailwind class、内部 state、ref、effect 细节当作产品 Contract。

## Validation

```bash
cd yakable-ui
npm run check
npm run build
```

## Boundary

全局前端规则只定义跨模块稳定约束；Service、Feature、Shared UI、Shared Lib 和测试使用各自最近的 RULES。
