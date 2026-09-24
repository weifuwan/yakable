# Project Generation Clarification

Status: Draft  
Domain: Project

Depends On:
- [Project Code Generation](./code-generation.md)

Related:
- [Create Project](./create.md)
- [Project Files Browse](./files-browse.md)
- [Send Message](../conversation/send-message.md)

Frontend:
- Clarification question rendering
- Clarification answer submission
- Generation resume after clarification

Backend:
- Project generation readiness assessment
- Clarification question generation
- Clarification answer persistence
- Generation context assembly
- Project generation resume

---

## 1. Problem

Project Code Generation V1 accepts a user prompt and starts generating project files directly.

This works when the prompt already contains enough information.

The problem appears when the prompt is incomplete.

For example:

> 帮我生成一个 Todo 应用。

There are several decisions that may materially change the generated project:

- Whether data needs persistence.
- Whether a backend is required.
- Whether authentication is required.
- Whether the application is single-user or multi-user.
- Whether an existing project constraint must be respected.

In V1, the model must either:

- Guess these decisions.
- Use implicit defaults.
- Generate a project based on assumptions the user never confirmed.

The generated code may be valid while the generated project is still wrong.

V2 must prevent the model from silently making important product or architecture decisions when required information is missing.

---

## 2. Goal

Before generating a project, Yakable determines whether the current generation context contains enough information to proceed.

If the information is sufficient:

```text
Prompt
  ↓
READY
  ↓
Generate Project
```

If important information is missing:

```text
Prompt
  ↓
Generation Readiness
  ↓
NEEDS_CLARIFICATION
  ↓
Ask Question
  ↓
User Answer
  ↓
Generation Readiness
  ↓
READY
  ↓
Generate Project
```

The goal is not to fully understand every possible user preference.

The goal is:

> Identify missing information that would materially change the generated project, ask the minimum necessary clarification questions, and only then start generation.

---

## 3. Non-Goals

V2 does not introduce:

- Project Spec.
- PRD generation.
- Execution Plan.
- Plan approval.
- Task decomposition.
- Multi-step agent planning.
- Architecture design documents.
- Long requirement interviews.
- Automatic product design.
- Mandatory clarification for every prompt.

Clarification is not a replacement for future Spec or Plan capabilities.

It only determines whether project generation can safely begin.

---

## 4. Core Principle

A model may choose implementation details.

A model should not silently choose important user requirements.

The distinction is:

### Implementation Detail

The model may decide reasonable implementation details when they do not materially change the user's requested product.

Examples:

- Internal helper method names.
- Small component boundaries.
- Local variable names.
- Minor CSS implementation details.
- Internal package organization that already follows repository rules.

### Requirement Decision

The model should ask when a missing decision materially changes the product, project structure, data model, security model, or major dependencies.

Examples:

- Frontend-only vs frontend + backend.
- Temporary data vs persistent data.
- Single-user vs authenticated multi-user.
- Existing repository modification vs new project creation.
- Required external service integration.

Clarification exists for requirement decisions, not every implementation choice.

---

## 5. Generation Readiness

Project generation introduces a readiness gate before execution.

The readiness result has two outcomes:

```text
READY
NEEDS_CLARIFICATION
```

### READY

The current context contains enough information to start generation.

Generation continues normally.

### NEEDS_CLARIFICATION

One or more important requirements are missing.

Generation must not start.

Yakable returns clarification questions instead.

---

## 6. Clarification Question

A clarification question represents one unresolved decision required before generation can continue.

Each question should contain:

```text
id
question
reason
options
allowCustomAnswer
```

Conceptually:

```json
{
  "id": "data-persistence",
  "question": "Todo 数据需要保存吗？",
  "reason": "这会决定是否需要数据库和后端。",
  "options": [
    "不需要，刷新后可以丢失",
    "保存到浏览器本地",
    "使用后端和数据库"
  ],
  "allowCustomAnswer": true
}
```

The exact persistence model and API contract are implementation concerns and may evolve independently from this capability contract.

---

## 7. Question Rules

Clarification must remain lightweight.

### 7.1 Ask only material questions

Do not ask questions whose answers have little effect on project generation.

Bad:

> 按钮圆角你喜欢 8px 还是 10px？

Good:

> 这个应用的数据需要持久化吗？

---

### 7.2 Prefer fewer questions

A clarification round should normally contain no more than 3 questions.

If only one blocking decision exists, ask only one.

Do not turn project generation into a questionnaire.

---

### 7.3 Prefer concrete choices

When common answers are predictable, provide options.

Example:

```text
是否需要用户登录？

○ 不需要
○ 邮箱密码登录
○ 第三方登录
○ 其他
```

Options reduce ambiguity and make later generation context easier to consume.

---

### 7.4 Allow custom answers

Users must not be forced into predefined options when those options do not fit their requirement.

---

### 7.5 Do not repeat resolved questions

Once a requirement has been answered, later clarification rounds must preserve that answer.

The model must not repeatedly ask the same semantic question using different wording.

---

## 8. Clarification Loop

Clarification may require more than one round.

Example:

```text
Prompt
  ↓
Assess
  ↓
Question A
  ↓
Answer A
  ↓
Assess
  ↓
Question B
  ↓
Answer B
  ↓
Assess
  ↓
READY
```

However, every additional round must be justified by newly discovered missing information.

The model must not intentionally split known questions across many rounds merely to create conversation.

---

## 9. Generation Context

Generation must not depend only on the latest user message.

Before execution, Yakable assembles a generation context containing:

```text
Original Prompt
+
Clarification Answers
+
Existing Project Context
+
Applicable Project Rules
```

Conceptually:

```text
GenerationContext
├── originalPrompt
├── clarificationAnswers
├── projectContext
└── rules
```

Clarification answers become part of the execution input.

The original prompt remains preserved.

Answers do not overwrite or rewrite the original user request.

---

## 10. Source of Truth

For Project Generation V2:

> Generation Context is the execution input.

The latest chat message alone is not the execution input.

This prevents generation from losing previously confirmed requirements.

Future Project Spec capabilities may replace Generation Context as the stronger structured source of truth.

V2 does not require that migration yet.

---

## 11. State

A project generation request may move through the following conceptual states:

```text
ASSESSING
    ↓
NEEDS_CLARIFICATION
    ↓
ASSESSING
    ↓
READY
    ↓
GENERATING
    ↓
COMPLETED
```

Existing generation failure and cancellation semantics remain unchanged.

Clarification itself is not generation.

While waiting for clarification:

```text
generationStarted = false
```

No project files should be generated or modified.

---

## 12. Execution Boundary

The readiness gate must exist before code generation begins.

Correct:

```text
User Prompt
  ↓
Readiness Assessment
  ↓
Clarification
  ↓
READY
  ↓
Project Code Generator
  ↓
Project Files
```

Incorrect:

```text
User Prompt
  ↓
Start Generating
  ↓
Discover Missing Requirement
  ↓
Ask User
```

Clarification is a pre-execution capability.

Generation must not partially execute before required clarification is complete.

---

## 13. Existing Project Context

Clarification must consider information Yakable already knows.

Do not ask the user for information that already exists in:

- The current request.
- Previous clarification answers.
- Existing project metadata.
- Existing generated project files when relevant.
- Explicit project configuration.
- Applicable Yakable capability or code rules.

Example:

If the project already uses React, do not ask:

> React 还是 Vue？

Existing project facts should reduce clarification, not create more questions.

---

## 14. Defaults

Defaults are allowed when they are:

- Low risk.
- Internal implementation details.
- Already established by Yakable project rules.
- Clearly implied by existing project context.

Defaults must not silently replace an important user decision.

When a default would materially affect the generated product, clarification is required.

---

## 15. Failure

If readiness assessment fails because of a model or system error:

- Project generation must not start.
- Existing user input must remain available.
- The failure must be retryable.
- No clarification answer may be lost.

A readiness failure must not automatically fall back to direct generation.

Failing open would restore the exact behavior this capability exists to prevent.

---

## 16. Resume

After the user submits clarification answers, Yakable resumes the same generation request.

The user should not need to submit the original prompt again.

Conceptually:

```text
Generation Request
       ↓
Clarification Pending
       ↓
User Answers
       ↓
Resume
       ↓
READY
       ↓
Generate
```

Clarification creates a pause in execution, not a new unrelated project generation request.

---

## 17. Invariants

The following rules must always hold.

### Invariant 1

Project generation must not begin while readiness is `NEEDS_CLARIFICATION`.

### Invariant 2

Clarification asks only for information that can materially affect generation.

### Invariant 3

Previously confirmed answers must remain part of later readiness assessments.

### Invariant 4

The same resolved requirement must not be repeatedly requested.

### Invariant 5

Clarification must not modify project files.

### Invariant 6

The original user prompt must remain preserved.

### Invariant 7

Generation starts only from the assembled Generation Context.

### Invariant 8

A readiness assessment failure must not silently fall back to direct generation.

### Invariant 9

Known project context must be reused instead of asking the user again.

### Invariant 10

Clarification must remain optional when the original request is already sufficient.

---

## 18. Example

User:

> 帮我生成一个 Todo 应用。

Readiness result:

```text
NEEDS_CLARIFICATION
```

Yakable asks:

```text
Todo 数据需要保存吗？

○ 不需要，刷新后可以丢失
○ 保存到浏览器本地
○ 使用后端和数据库
```

User:

> 使用后端和数据库。

Yakable reassesses the context.

If authentication materially affects the requested project:

```text
是否需要用户登录？

○ 不需要
○ 邮箱密码登录
```

User:

> 不需要。

Readiness result:

```text
READY
```

Generation context:

```text
Original Prompt:
帮我生成一个 Todo 应用。

Confirmed Requirements:
- 使用后端和数据库持久化 Todo。
- 不需要用户登录。
```

Project generation begins.

---

## 19. Acceptance Criteria

Project Generation Clarification V2 is complete when:

- A generation request is assessed before project generation starts.
- Sufficient prompts can continue directly without clarification.
- Insufficient prompts return clarification questions instead of generating code.
- A clarification round supports one or more questions.
- Clarification answers are preserved.
- Answers participate in the next readiness assessment.
- Multiple clarification rounds are supported.
- Previously answered questions are not repeated.
- Generation resumes without requiring the original prompt again.
- Generation does not start until readiness becomes `READY`.
- The final generation input contains the original prompt and confirmed clarification answers.
- Clarification does not write or modify project files.
- Assessment failures do not fall back to direct generation.
- Existing project context is reused when determining whether clarification is required.

---

## 20. Future Evolution

V2 stops at:

```text
Prompt
  ↓
Clarification
  ↓
Generation Context
  ↓
Generate
```

A future version may evolve toward:

```text
Prompt
  ↓
Clarification
  ↓
Project Spec
  ↓
Execution Plan
  ↓
Approval
  ↓
Execution
```

Those capabilities should be introduced only when their corresponding problems need to be solved.

Clarification does not need to predict or implement that entire architecture today.
