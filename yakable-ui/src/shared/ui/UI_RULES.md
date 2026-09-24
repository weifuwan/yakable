# Shared UI Rules

Scope:

- `yakable-ui/src/shared/ui/**`

Depends On:

- `../../../FRONTEND_RULES.md`
- `../../../TEST_RULES.md`

Owns:

- Yakable 产品可复用 UI Primitive
- Primitive keyboard / focus behavior
- Primitive visual contract

Public Import:

- `@/shared/ui`

Implementation Base:

- `shared/ui` 是 Yakable 内部的 Yak UI 层，不是业务 Feature。
- `@base-ui/react` 作为需要 Headless interaction 的默认底层能力，只允许由 `shared/ui` 封装。
- Yak UI 自己拥有公开 Props、Design Token 和 Tailwind 视觉 Contract；Base UI 只负责底层交互、状态语义与 accessibility。

## Must

- Primitive 必须 feature-agnostic。
- Product Feature 从 `@/shared/ui` 根 barrel 导入公共 Primitive。
- 优先原生 HTML 语义，并保留键盘、焦点、disabled 行为。
- `Button` / `IconButton` 默认 `type="button"`，避免意外提交表单。
- Button 视觉意图通过 `variant / size / shape` Contract 表达。
- `Button className` 只用于宽度、定位、外部间距等布局 escape hatch。
- Link 必须保持原生 `<a>` 语义；需要 Button 外观时复用 `buttonVariants` 等视觉 Contract，不把链接伪装成 Button。
- 每个 `IconButton` 必须有可访问的 `aria-label`。
- `Icon` 默认装饰性；只有 Icon 自身承载语义时提供 label。
- `PromptComposer` 拥有 autosize、IME、Enter / Shift+Enter、submit / stop 输入机制。
- PromptComposer 的 submit / stop 控件复用共享 Button Contract。
- PromptComposer chassis 拥有 shadow、fill、highlight、rim、focus glow、halo 等 surface。
- Animated placeholder 只负责视觉提示，禁止写入 textarea value 或 submission payload。
- Markdown 消息统一通过共享 `Markdown` renderer。
- `Select` 拥有 trigger、floating menu、radio selection、keyboard navigation、focus restore、viewport positioning。
- Select 外观通过 `surface` Contract 选择。
- 只有出现真实、稳定、重复使用的 UI Boundary 时才新增 Primitive。

## Must Not

- 让 Shared UI 知道 Project、Session、Workspace、Editor、Agent 等产品业务规则。
- 在 Page / Feature / App 直接导入 `@base-ui/react`，绕过 Yak UI 边界。
- 从 `@/shared/ui` 直接 re-export Base UI 原始 Primitive。
- Feature 用 className 重定义 Button 的颜色、背景、border、radius、control height。
- Feature 自己重建 PromptComposer chassis。
- Feature 绕过 Shared Markdown 自己解析 / 渲染消息 Markdown。
- Feature 用 className 重建 Select surface effect。
- 把 Build / Plan 等 Feature 模式语义塞进 Select。
- 因为视觉上复用过一次就提前提升组件到 Shared。
- 把 shared/ui 扩成第二个产品 Feature 层。

## Tests

Primitive 只保护稳定、用户可观察的交互 Contract：

- keyboard
- focus
- native semantics
- selection
- submit / stop
- accessibility name

不测试 Tailwind class 字符串或纯视觉尺寸。

## Boundary

```text
yakable-ui/src/shared/ui
= 构建 Yakable 产品自身的 UI Primitive

Frontend Harness Component Library
= 暴露给生成项目的受控组件与 metadata
```

两者可以共享设计思想，但 owner 不同，禁止隐式耦合。
