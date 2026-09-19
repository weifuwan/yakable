# yakable-plugin-model-openai-compatible

## Purpose

Own reusable protocol/client behavior for providers exposing an OpenAI-compatible chat-completions API.

## Owns

- OpenAI-compatible HTTP payload mapping
- shared request/response transport behavior
- reusable client logic for compatible providers

## Does not own

- Yakable Application model orchestration
- DeepSeek-specific descriptor/configuration choices
- Session/Turn context selection
- general-purpose HTTP utilities unrelated to model providers

## Key entry point

```text
src/main/java/io/yakable/plugin/model/openai/
└── OpenAiCompatibleClient.java
```

## Dependency boundary

Depends on `yakable-plugin-model-api`. Concrete compatible provider plugins may depend on this module.

## Add to context when

Load this module when a provider issue is actually caused by OpenAI-compatible wire protocol, payload serialization, endpoint handling, or shared response parsing.

Do not load it merely because the selected provider happens to use it.
