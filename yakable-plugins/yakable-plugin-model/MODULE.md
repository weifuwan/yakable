# yakable-plugin-model

## Purpose

Aggregate the model-plugin Maven modules and define the provider-extension family boundary.

## Modules

```text
yakable-plugin-model-api
yakable-plugin-model-openai-compatible
yakable-plugin-model-deepseek
yakable-plugin-model-all
```

## Owns

- Maven aggregation for model plugins
- grouping of stable plugin API, shared protocol clients, concrete providers, and runtime aggregation

## Does not own

- Application model orchestration
- Session/Turn behavior
- provider-independent business policy

## Dependency direction

```text
plugin-api
   ↑
openai-compatible
   ↑
deepseek

plugin-all -> concrete built-in plugins
```

Application sees `ModelGateway`; Infrastructure adapts it to this plugin family.

## Add to context when

Use this anchor to choose the specific plugin submodule. Do not load every provider by default.
