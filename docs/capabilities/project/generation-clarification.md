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
- Generation phase persistence
- Clarification question generation
- Clarification answer persistence
- Frozen generation context assembly
- Project generation resume

Data:
- Initial `PROJECT_GENERATION` Turn
- Generation Phase
- Clarification Rounds
- Frozen Generation Context Snapshot

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

Readiness is a decision owned by the existing Initial `PROJECT_GENERATION` Turn. It is not a new Turn status and does not create a second generation request.

### 5.1 Initial Turn Ownership

The Project, initial Session, Initial `PROJECT_GENERATION` Turn, and original USER Message are still created by Create Project.

Project Generation Clarification extends that same Initial Turn.

```text
Create Project
    ↓
Project + Session + Initial PROJECT_GENERATION Turn + USER Message
    ↓
Readiness Assessment
    ├── READY
    │     ↓
    │   Code Generation
    │
    └── NEEDS_CLARIFICATION
          ↓
       Clarification
          ↓
       Readiness Assessment
          ↓
       READY
          ↓
       Code Generation
```

The following rules apply:

- The original Initial Turn remains the owner of readiness assessment, clarification, and final code generation.
- Clarification must not create another Conversation Turn.
- Clarification answers must not go through the normal Send Message path.
- The original USER Message remains the original project request and is not rewritten.
- Provider and model identity remain fixed on the Initial Turn.
- While clarification is waiting for user input, the Initial Turn still occupies the active generation lifecycle for the Session; a second active Turn must not be created to continue the same initial generation.

V2 does not introduce a separate generic Generation Request, Planning Turn, or Clarification Turn.

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

### 8.1 Clarification Persistence

Clarification is durable generation data bound to the Initial Turn.

Conceptually:

```text
Initial PROJECT_GENERATION Turn
│
├── Original USER Message
│
└── Generation Clarification
      ├── currentRevision
      ├── rounds
      │    ├── questions
      │    └── answers
      └── phase
```

The physical database schema is an implementation detail, but the persistence semantics are part of this contract:

- Clarification data is keyed by the Initial Turn identity.
- Questions and confirmed answers survive refresh, reconnect, and service restart.
- A clarification answer updates the same Initial Turn generation lifecycle; it does not create a replacement Turn.
- Previous confirmed answers remain available to every later readiness assessment.
- Waiting clarification is recoverable from persisted data and must not depend on in-memory state.
- Clarification data is separate from ordinary Conversation Message history even if the frontend renders it inside the conversation experience.
- Once the generation context has been frozen, late clarification answers must not mutate that context.

---

## 9. Generation Context Snapshot

Generation must not depend only on the latest user message.

Before code generation becomes executable, Yakable assembles a complete generation context containing:

```text
Original Prompt
+
Confirmed Clarification Answers
+
Existing Project Context
+
Applicable Project Rules
```

Conceptually:

```text
GenerationContextSnapshot
├── turnId
├── originalPrompt
├── clarificationAnswers
├── projectContext
└── rules
```

Clarification answers become part of the execution input.

The original prompt remains preserved.

Answers do not overwrite or rewrite the original user request.

### 9.1 Freeze Boundary

`READY` is not only a model decision. It is a persistence boundary.

Before the Initial Turn becomes generation-executable, Yakable must persist an immutable Generation Context Snapshot.

```text
Readiness Assessment
      ↓
READY
      ↓
Persist Frozen Generation Context Snapshot
      ↓
Generation Executable
      ↓
ProjectCodeGenerator
```

The following rules apply:

- `READY` must not be observable without a complete persisted Generation Context Snapshot.
- The snapshot becomes immutable once generation is executable.
- Project Code Generation reads the frozen snapshot instead of rebuilding context from mutable live state.
- Retry and Recovery reuse the same frozen snapshot.
- Late clarification answers cannot modify an existing frozen snapshot.
- Changes to project metadata or rules after the freeze do not silently change the input of the already-established Initial Turn.
- The Initial Turn remains the source of provider and model identity; the snapshot does not create a second execution identity.

The transition that makes generation executable and the persistence of its snapshot must behave as one durable boundary: recovery must never observe `READY` without the snapshot required to execute it.

---

## 10. Source of Truth

For Project Generation V2:

> The frozen Generation Context Snapshot is the code-generation input.

The latest chat message alone is not the execution input.

The original USER Message remains the source of the original request, clarification persistence remains the source of confirmed answers, and the frozen snapshot is the immutable input used once readiness becomes `READY`.

Future Project Spec capabilities may replace the snapshot with a stronger structured source of truth.

V2 does not require that migration yet.

---

## 11. Generation Phase

Generation Phase is a Project Generation sub-state owned by the Initial `PROJECT_GENERATION` Turn.

It does not replace the existing Conversation Turn status:

```text
TurnStatus
PENDING / RUNNING / SUCCEEDED / FAILED / STOPPED

GenerationPhase
ASSESSING / WAITING_CLARIFICATION / READY / GENERATING / COMPLETED
```

The normal lifecycle is:

```text
TurnStatus=PENDING
GenerationPhase=ASSESSING
        ↓
        ├── missing blocking information
        │      ↓
        │   TurnStatus=PENDING
        │   GenerationPhase=WAITING_CLARIFICATION
        │      ↓
        │   User Answer
        │      ↓
        │   GenerationPhase=ASSESSING
        │
        └── sufficient information
               ↓
            Freeze Generation Context Snapshot
               ↓
            TurnStatus=PENDING
            GenerationPhase=READY
               ↓
            Claim generation execution
               ↓
            TurnStatus=RUNNING
            GenerationPhase=GENERATING
               ↓
            Publish complete Project Files
               ↓
            TurnStatus=SUCCEEDED
            GenerationPhase=COMPLETED
```

Existing `FAILED` and `STOPPED` Turn terminal semantics remain authoritative. Generation Phase does not create duplicate terminal states.

Clarification itself is not code generation.

While waiting for clarification:

```text
TurnStatus = PENDING
GenerationPhase = WAITING_CLARIFICATION
generationStarted = false
```

No project files should be generated or modified.

### 11.1 Scheduling and Recovery

A `PENDING` Turn is not automatically generation-executable.

Execution and Recovery must inspect Generation Phase.

- `PENDING + WAITING_CLARIFICATION` is blocked on user input and must not be dispatched to Project Code Generation.
- `PENDING + READY` is generation-executable and may be dispatched or recovered.
- `RUNNING + GENERATING` follows the existing stale RUNNING recovery rules.
- Recovery of a `READY` Turn must reuse the frozen Generation Context Snapshot.
- Recovery must never convert waiting clarification into code generation merely because the Turn itself is `PENDING`.
- `STOPPED` or `FAILED` terminates the Initial Turn regardless of its last Generation Phase.

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

After the user submits clarification answers, Yakable resumes the same Initial `PROJECT_GENERATION` Turn.

The user should not need to submit the original prompt again, and Yakable must not create another Turn to resume.

Conceptually:

```text
Initial PROJECT_GENERATION Turn
       ↓
WAITING_CLARIFICATION
       ↓
User Answers
       ↓
ASSESSING
       ↓
READY + Frozen Generation Context Snapshot
       ↓
GENERATING
```

Clarification creates a persisted pause in the Initial Turn generation lifecycle, not a new unrelated project generation request.

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

### Invariant 11

Readiness, clarification, and final initial code generation belong to the same Initial `PROJECT_GENERATION` Turn.

### Invariant 12

Clarification questions and answers must be durably persisted against that Initial Turn and must not require additional Conversation Turns.

### Invariant 13

`PENDING + WAITING_CLARIFICATION` must never be dispatched as executable Project Code Generation.

### Invariant 14

`READY` must always have a complete persisted frozen Generation Context Snapshot.

### Invariant 15

Project Code Generation Retry / Recovery must reuse the same frozen Generation Context Snapshot and must not rebuild it from later mutable state.

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
- Clarification answers are durably preserved against the original Initial `PROJECT_GENERATION` Turn.
- Clarification does not create additional Conversation Turns.
- Answers participate in the next readiness assessment.
- Multiple clarification rounds are supported.
- Previously answered questions are not repeated.
- Generation resumes on the same Initial Turn without requiring the original prompt again.
- Generation Phase is persisted separately from the existing Turn terminal status.
- `PENDING + WAITING_CLARIFICATION` is not generation-executable and is ignored by code-generation Recovery.
- Generation does not start until readiness becomes `READY`.
- A complete Generation Context Snapshot is persisted before `READY` becomes executable.
- The frozen generation input contains the original prompt and confirmed clarification answers.
- Project Code Generation and its Retry / Recovery reuse the same frozen snapshot.
- Late clarification answers cannot mutate the frozen snapshot.
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
