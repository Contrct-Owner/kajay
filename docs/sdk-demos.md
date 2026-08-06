# SDK demos

- Area: SDK integration examples
- Status: active
- Owner: Jarod
- Last updated: 2026-08-06

The SDK demo is one TypeScript renderer and Creator application backed by equivalent
C# and TypeScript HTTP APIs. The screen and authored definition stay constant while a
runtime selector chooses which SDK is authoritative or compares both live.

## Run with Docker Compose

The recommended profile starts both runtimes and publishes the demo at
<http://localhost:4173>:

```bash
docker compose --profile compare up --build
```

Use **Compare** to send each operation to both runtimes concurrently, or select
**.NET** or **TypeScript** to direct requests to one API. The comparison checks
canonical definitions, diagnostic identity, validation identity, lifecycle outcome,
response data, and quiz score. Message wording is intentionally ignored. A mismatch is
visible and rejected; an answer-validation mismatch blocks navigation.

The individual profiles remain useful when inspecting one integration:

```bash
docker compose --profile dotnet up --build
docker compose --profile typescript up --build
```

Each profile publishes port 4173, so run one frontend profile at a time. Stop it with
`docker compose --profile <profile> down`.

## Run from source

Start the two APIs and frontend in separate terminals:

```bash
dotnet run --project dotnet/apps/Kajay.Demo.Api --urls http://localhost:5080
pnpm --filter @kajay/sdk-demo-api build
PORT=5081 pnpm --filter @kajay/sdk-demo-api start
VITE_KAJAY_RUNTIME=compare pnpm --filter @kajay/sdk-demo dev
```

Use its TypeScript build in watch mode when iterating on the API. Vite serves
<http://localhost:5174> and proxies the runtime-qualified API paths to ports 5080 and
5081.

## API behavior demonstrated

Both hosts expose the same application operations:

| Endpoint | SDK behavior |
| --- | --- |
| `GET /api/demo/definition` | Parse and canonicalize the shared definition |
| `POST /api/demo/definitions/validate` | Return stable authoring diagnostics and canonical JSON |
| `POST /api/demo/answers/validate` | Run host/server validation inside the renderer's forward-navigation gate |
| `POST /api/demo/submissions` | Apply answers, settle logic, advance lifecycle gates, validate, and score the quiz |
| `GET /health` | Container/API liveness |

The C# host additionally publishes its generated OpenAPI document at
`/openapi/dotnet/v1.json` through the demo proxy. Use `blocked@example.com` in the
renderer to prove that the same host-supplied validator rejects an otherwise valid
submission in both runtimes. A successful result includes the `profileComplete`
calculated value and rating quiz score.

## Source map

- `apps/sdk-demo/src/features/demo/` owns the frontend feature, narrow `DemoRuntime`
  interface, HTTP adapters, and comparing decorator.
- `apps/sdk-demo-api/` owns the Node HTTP host for public `@kajay/core` operations.
- `dotnet/apps/Kajay.Demo.Api/` owns the C# application use cases and thin HTTP
  endpoints over public `Kajay.Core` interfaces.
- `apps/sdk-demo/public/demo-survey.json` is the single authored input used by both
  APIs and the Creator.

This remains an integration example, not a third runtime contract. Cross-language
semantic compatibility is versioned and exhaustively proved by `conformance/v*/`.

## Parent and related links

- [Project context](../CONTEXT.md)
- [Dual-runtime comparison decision](./adr/0033-dual-runtime-compatibility-demo.md)
- [C# SDK decision](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md)
