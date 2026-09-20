# yakable-core 编程规范

适用于 `yakable-core` 下所有 Java 代码，只保留关键约束。

## 格式

1. 能一行写完就一行；只有明显过长时才换行。换行保持紧凑、统一，禁止无意义换行，禁止把 `) {` 或右括号单独悬空。

## 复用

2. 通用能力优先复用 `yakable-common`，包括字符串、JSON、对象转换、时间、ID、线程等；已有能力禁止重复封装。

3. Common 暂无但具有复用价值的能力，先补 Common；仅当前类独有且简单的逻辑保留为 `private`。

## 边界

4. Core 保持纯 Java，禁止 Spring / Spring Boot 和 `@Resource` 等容器注解；Bean 装配、配置读取放在 Boot 或 Service。

5. 能明显减少样板代码时优先使用 Lombok；record 已足够简洁时继续使用 record。

## 结构

6. 一个类只承担明确职责；不为少量重复提前拆 Manager、Helper、Handler、Adapter 或公共接口，禁止无意义中间层和转发。

## 注释

7. 公共接口、公共类和核心方法写必要 Javadoc，只说明职责、边界、约束和为什么；接口已有注释，实现类不重复。

8. 简单私有代码不强制注释；复杂、兼容性或非直观逻辑必须注释，过期注释必须删除。
