# yakable-plugin-model-deepseek

## Purpose

Own the DeepSeek provider plugin.

## Owns

- DeepSeek plugin descriptor
- provider registration
- mapping DeepSeek configuration into the shared compatible client
- DeepSeek-specific defaults and behavior

## Does not own

- generic model orchestration
- Session/Turn lifecycle
- generic OpenAI-compatible transport behavior
- global model-selection policy

## Key entry points

```text
src/main/java/io/yakable/plugin/model/deepseek/
└── DeepSeekModelPlugin.java

src/test/java/io/yakable/plugin/model/deepseek/
└── DeepSeekModelPluginTest.java
```

## Dependency boundary

Depends on the model plugin API and the shared OpenAI-compatible implementation. Keep provider-specific concerns here rather than leaking them into Application.

## Add to context when

Load this module for DeepSeek registration, configuration, provider defaults, or provider-specific failures.

If the failure is generic wire-protocol behavior, expand into `yakable-plugin-model-openai-compatible`.
