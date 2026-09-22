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
- 状态按事实来源放置：URL 已表达的状态归 URL；服务端业务状态以 Service 返回的真实数据为准；只有当前交互边界拥有的可变 UI 状态才使用 `useState`。
- React state 放在拥有该行为的最小边界，不为了共享方便提前上全局状态，也不复制同一份事实来源。
- 可由 props、state 或现有数据直接计算出的值优先直接派生，不维护第二份同步 state。
- `useMemo` 只用于有实际计算成本，或引用稳定性会影响下游行为的派生值，不作为普通计算的默认写法。
- `useCallback` 只在稳定函数引用对 Hook dependency、memoized child 或外部订阅有实际意义时使用，普通事件处理函数直接定义。
- Effect 只处理 React 外部同步 / 生命周期；只有在同步 URL、浏览器 API、订阅、第三方实例等外部状态时才应在 Effect 中更新 state。
- Hook dependency 保持完整；确需绕过依赖检查时只做最小范围 disable，并写明为什么依赖可以安全省略。
- React 组件定义在模块作用域，不在组件 render 内动态声明子组件。
- 公共组件、Hook 和类型优先使用具名导出；`index.ts` 只暴露当前 ownership 的公共 API，不创建跨 Feature / Domain 的临时聚合入口。
- 浏览器端只展示真实后端状态，不伪造 Assistant、Project 或其他服务端业务结果。
- Render 期间不写 ref；ref 同步放在 effect 或事件边界。
- Oxlint / TypeScript / Oxfmt 已覆盖的问题按工具规则修复，不用宽泛 disable 绕过。
- 修改完成后至少运行与改动匹配的验证；提交前完整验证使用 `npm run check` 和 `npm run build`。

## Must Not

- 违反 `app → pages → features → service/shared` 的依赖方向。
- 在 Page / Component / Hook 直接调用 `fetch`。
- 为简单前端调用增加 interface / impl / adapter 等 Java 风格层级。
- 在 Shared 引入 Project、Session、Model、Agent 等产品业务语义。
- 为未来能力预创建空 Feature、状态层或菜单入口。
- 用 `useEffect + setState` 维护可以直接派生的数据副本。
- 为了形式上的“性能优化”给普通值和事件处理函数默认套 `useMemo` / `useCallback`。
- 在组件 render 内定义子组件，导致组件 identity 随 render 重新创建。
- 用跨 Feature / Domain 的 barrel export 隐藏真实依赖方向。
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
