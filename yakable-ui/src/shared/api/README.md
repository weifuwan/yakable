# Shared API

`shared/api` is intentionally small.

It currently owns only generic API-related primitives that already have a clear reusable boundary:

- request cancellation classification
- generic API error types

It does not currently provide an HTTP client or stream abstraction.

## Feature API rule

Business endpoints belong to their owning feature:

```text
page / component
      ↓
feature/api
      ↓
browser API
```

A feature API may use native `fetch` directly while the transport behavior is simple.

Do not move endpoint paths, request/response models, or feature protocol rules into `shared/api`.

## When to add transport infrastructure

Introduce a shared HTTP or stream abstraction only after repeated product code shows a concrete need, for example:

- the same error normalization appears across several features
- authentication or headers must be applied consistently
- cancellation behavior is repeated
- streaming decoding is repeated
- retries, timeouts, or observability need one owner

Until then, native browser APIs are the simpler contract.
