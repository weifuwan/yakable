# Shared API

`shared/api` owns browser transport infrastructure only.

It may know about:

- HTTP requests and headers
- JSON serialization / parsing
- HTTP, network, and response parsing errors
- AbortSignal handling
- generic stream / NDJSON decoding

It must not know about Product, Workspace, Editor, Agent Run, or any other product feature.

## Usage

Feature APIs describe business endpoints and use this transport boundary:

```ts
import { requestJson } from '@/shared/api';

return requestJson<Project>('/api/projects/123');
```

For JSON request bodies, use the `json` option instead of manually stringifying:

```ts
return requestJson<Project>('/api/projects', {
  method: 'POST',
  json: { name },
});
```

## Rules

- pages and components do not call `fetch` directly
- feature API modules do not reimplement HTTP error handling or stream readers
- domain response validation and mapping belong to the owning feature
- `shared/api` stays provider- and feature-agnostic
