# Backend Test Rules

Scope:
- Yakable 后端自动化测试
- 需要回归证据的 Java 行为

Load With:
- `JAVA_RULES.md`
- 被测试代码所属层的 RULES

Owns:
- 业务行为验证
- HTTP Contract 验证
- 持久化验证
- Provider / Protocol 稳定规则验证

## When Tests Are Required

以下变化应新增或更新测试：

- Service 业务规则、状态流转、异常分支。
- Controller 请求、响应、HTTP 状态、错误码、SSE Contract。
- Repository / Mapper 自定义查询、更新、事务、Mapper XML。
- LLM、Streaming、Context 等核心运行时行为。
- 需要长期防回归的 Bug。

以下内容默认不单独补测试：

- DTO / VO / Entity 样板代码。
- Lombok 生成代码。
- 简单枚举、常量。
- 框架已经保证的普通 CRUD。
- private 实现细节。
- 没有业务语义的纯透传。

一个测试失败后应该能说明“哪个稳定行为被破坏”。否则通常不值得增加。

## Test Boundary

### Service

- 使用 JUnit + Mockito。
- Mock Repository、LLM 和边界外 Service。
- 不启动完整 Spring Boot。
- 测试结果、业务异常、状态变化和有意义的协作。

### Controller

- 优先 `@WebMvcTest + MockMvc`。
- Mock Service。
- 测试参数校验、HTTP Status、`Result<T>`、错误映射、SSE / Streaming 协议。
- 不重复 Service 业务测试。

### DAO

- 只测试自定义持久化行为。
- Repository / Mapper Integration Test 使用 Testcontainers + MySQL。
- Integration Test 不 Mock Mapper 和数据库。
- 不重复测试 MyBatis-Plus 普通 CRUD。

### Model Plugin

验证稳定、确定性的协议行为：

- 请求转换
- 响应解析
- Streaming Event 转换
- Provider 错误转换
- Model metadata
- context window / token 规则

禁止调用真实第三方模型 API。

## Mock Rules

Must:
- 只 Mock 被测试行为边界之外的依赖。
- 只有协作本身属于 Contract 时才验证调用次数或参数。

Must Not:
- Mock 被测试行为本身。
- 同时 Mock Repository、Mapper、MyBatis 内部对象。
- 为覆盖实现细节而对所有内部调用做 `verify`。

## Stability

测试必须可重复、可独立执行。

Must Not:
- 用 `Thread.sleep()` 等待异步结果。
- 依赖测试执行顺序。
- 依赖生产数据。
- 访问真实第三方服务。
- 使用真实账号或密钥。
- 用随机结果决定测试是否通过。

优先使用固定 ID、固定时间和明确业务值。

## Location

Unit Test：

```text
<module>/src/test/java/.../XxxTest.java
```

Integration Test：

```text
<module>/src/test/java/.../XxxIT.java
```

测试跟随所属 Maven Module，不集中堆到全局 tests 目录。

## Spring Boundary

优先级：

```text
JUnit + Mockito
→ Spring Test Slice
→ Integration Test
→ @SpringBootTest
```

只有完整应用装配本身需要验证时才使用 `@SpringBootTest`。

## Execution

```text
./mvnw test
→ 快速 *Test.java

./mvnw verify
→ Unit Test + *IT.java
```

普通 Unit Test 不依赖 Docker、MySQL 或外部服务。
