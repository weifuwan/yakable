# Model Plugin Contract

> Model plugins are the stable extension boundary for LLM providers in Yakable.

## Module responsibilities

```text
yakable-plugin-model-api
  -> stable plugin contracts; no Spring and no provider-specific code

yakable-plugin-model-openai-compatible
  -> shared OpenAI-compatible protocol client

yakable-plugin-model-deepseek
  -> DeepSeek provider implementation

yakable-plugin-model-all
  -> runtime aggregation of built-in model plugins
```

Core/runtime responsibilities:

```text
yakable-core
  -> ServiceLoader discovery, registry validation and provider routing

yakable-boot
  -> application assembly and provider configuration only
```

## Stable plugin entry

Each provider implements `ModelPlugin`:

```java
ModelPluginDescriptor descriptor();

LlmResponse chat(
    ModelPluginConfiguration configuration,
    LlmRequest request
);
```

Plugins must be registered with AutoService:

```java
@AutoService(ModelPlugin.class)
public final class DeepSeekModelPlugin implements ModelPlugin {
    ...
}
```

AutoService generates:

```text
META-INF/services/io.yakable.plugin.model.api.ModelPlugin
```

at compile time. Runtime discovery still uses standard Java `ServiceLoader`.

Core and Business code must never instantiate a concrete provider plugin directly.

## Descriptor

`ModelPluginDescriptor` is the stable provider metadata contract:

```text
provider
displayName
apiVersion
capabilities
```

Current API version:

```text
1
```

Current capability:

```text
CHAT
```

Registry startup validates:

- descriptor is present;
- provider identity is consistent;
- API version is supported;
- required capabilities are declared;
- provider IDs are unique.

## Provider vs protocol

A provider is not a protocol.

```text
DeepSeek ----\
Kimi --------+--> OpenAI-compatible protocol
Qwen --------/
```

Provider plugins own provider identity and defaults.

Protocol modules own HTTP request/response mapping.

Do not copy `/chat/completions`, authorization, message mapping, SSE parsing, or usage parsing into every provider plugin when the providers share the same protocol.

## Lifecycle

`ModelPlugin` implementations are discovered once and may be reused by the registry.

Plugins must not keep request-level mutable state.

Request-specific information is passed through:

```text
ModelPluginConfiguration
LlmRequest
```

Secrets must not be logged or included in exceptions.

## Configuration

Boot maps application configuration to `ModelPluginConfiguration`.

Current provider configuration:

```yaml
yakable:
  model:
    providers:
      deepseek:
        api-key: ${DEEPSEEK_API_KEY:}
        base-url: ${DEEPSEEK_BASE_URL:https://api.deepseek.com}
```

A plugin owns provider defaults. Boot must not import or construct the concrete plugin class.

## Adding a provider

For an OpenAI-compatible provider:

```text
1. add yakable-plugin-model-<provider>
2. depend on yakable-plugin-model-api
3. depend on yakable-plugin-model-openai-compatible
4. implement ModelPlugin
5. annotate implementation with @AutoService(ModelPlugin.class)
6. define descriptor/provider defaults
7. add the module to yakable-plugin-model-all
8. add ServiceLoader assembly test
9. add provider protocol/configuration tests
```

Do not modify `SessionService` when adding a provider.

If a provider requires a protocol the platform does not have yet, introduce a protocol module instead of adding provider-specific HTTP code to Core or Boot.

## Review checklist

```text
[ ] Plugin API has no Spring dependency
[ ] Concrete provider is outside yakable-core and yakable-boot
[ ] @AutoService(ModelPlugin.class) is present
[ ] ServiceLoader assembly test passes
[ ] descriptor provider/apiVersion/capabilities are valid
[ ] duplicate provider registration is rejected
[ ] secrets are not logged
[ ] shared protocol logic is not copied into provider plugins
[ ] SessionService does not know concrete providers
```
