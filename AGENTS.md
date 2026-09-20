# Yakable Agent Guide

本文件是 Agent 进入 Yakable 后的执行入口，只负责规范路由和任务边界，不重复定义具体编码规则。

## 规范路由

修改任何 Java 代码前，先读取：

```text
JAVA_GLOBAL_CODE_README.md
```

再按修改范围读取对应规范：

```text
yakable-service/**        -> yakable-service/SERVICE_README.md
yakable-core/**           -> yakable-core/CORE_README.md
yakable-core/**/llm/**    -> yakable-core/src/main/java/io/yakable/core/llm/LLM_DESIGN.md
yakable-common/**         -> yakable-common/COMMON_CODE.md
yakable-dao/**/entity/**  -> yakable-dao/ENTITY_README.md
yakable-dao/**/repository/**
yakable-dao/**/mapper/**  -> yakable-dao/REPOSITORY_README.md
db/migration/**           -> yakable-dao/FLYWAY_README.md
yakable-ui/**             -> yakable-ui/ARCHITECTURE.md
yakable-ui/src/service/** -> yakable-ui/SERVICE_README.md
```

一个任务涉及多个模块时，只加载实际涉及的规范，不默认读取全部文档。

## 执行规则

1. 修改前先看现有代码和调用关系，优先沿用已有结构、工具和命名。

2. 只解决当前任务，不主动扩大范围，不顺手重构无关代码。

3. 优先修改现有实现；没有真实必要时，不新增层级、抽象、兼容代码或中间组件。

4. 已有公共能力、基础类和框架能力必须优先复用，禁止重复实现。

5. 新增代码必须符合全局 Java 规范和当前模块规范；冲突时以更具体的模块规范为补充，但不得违反全局硬约束。

6. 修改完成后检查受影响调用链和相关规范；能执行验证时优先做最小必要验证，未验证的内容必须明确说明。

## Context 原则

默认上下文只加载：

```text
任务目标
+ JAVA_GLOBAL_CODE_README.md
+ 当前模块规范
+ 目标代码
+ 直接依赖
```

只有问题确实向下延伸时，再继续读取 Repository、Mapper、SQL、Provider、Protocol 等实现。

**先定位，再读取；先约束，再修改。**
