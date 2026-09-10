# Yakable Plan

1. **搭建产品骨架：**以 React、TypeScript、Vite、Tailwind 为首个生成模板，完成 Web、API、Agent Worker、PostgreSQL、Redis 和对象存储的最小可运行架构。
2. **打通 AI Coding Agent：**实现从自然语言需求到读取项目、修改代码、执行命令、读取错误并持续修复的完整 Agent Loop。
3. **建立安全 Sandbox：**为每个项目提供隔离运行环境，支持依赖安装、构建、命令执行、资源限制和生命周期管理。
4. **完成实时 Preview：**将 Sandbox 中的开发服务安全暴露为独立预览地址，并支持构建日志、HMR 和实时刷新。
5. **建立项目与版本系统：**使用 Git 管理每次 AI 修改的快照、Diff、回滚以及后续 GitHub 同步能力。
6. **实现 Visual Edit：**支持在 Preview 中选择页面元素，并建立 DOM 到 React/TSX 源码的定位与修改链路。
7. **构建 Model Gateway：**先接入 Claude，并通过统一 Provider 接口逐步扩展 Qwen、OpenAI、Gemini 和模型路由能力。
8. **构建 Executable Taste Engine：**通过截图、设计规则和视觉模型自动发现 UI 问题、生成改进计划并驱动 Coding Agent 重构页面。
9. **补齐 Full-stack 与发布能力：**逐步加入数据库、Auth、API、Secrets、部署和自定义域名，让 Yakable 从前端生成器走向完整 AI App Builder。
