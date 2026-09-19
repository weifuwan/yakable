# yakable-plugin-model-api

## Purpose

Own the stable contract implemented by model-provider plugins.

## Owns

- `ModelPlugin`
- plugin descriptor/configuration types
- provider-neutral LLM request/response/message types
- model capability declaration
- plugin exception contract

## Does not own

- Application `ModelGateway` orchestration
- HTTP client implementations
- DeepSeek/OpenAI-compatible protocol details
- Session/Turn context policy

## Key entry points

```text
src/main/java/io/yakable/plugin/model/api/
├── ModelPlugin.java
├── ModelPluginDescriptor.java
├── ModelPluginConfiguration.java
├── ModelCapability.java
├── LlmRequest.java
├── LlmMessage.java
├── LlmResponse.java
└── LlmUsage.java
```

## Dependency boundary

Keep this module provider-neutral and implementation-light. Concrete provider modules depend on it; it must not depend on them.

## Add to context when

Load this module when changing the plugin contract, request/response boundary, capabilities, or provider registration semantics.

For a single provider bug, load only the necessary API types plus that provider.
