# SDK demos

- Area: SDK integration examples
- Status: active
- Owner: Jarod
- Last updated: 2026-08-06

The SDK demo is one TypeScript renderer and Creator application with two runtime
profiles. The screen and definition stay the same; the profile selects which SDK owns
definition validation and final submission.

## Run with Docker Compose

Choose one profile at a time because both publish the demo at
<http://localhost:4173>.

```bash
docker compose --profile dotnet up --build
```

The `dotnet` profile starts the C# 14 ASP.NET Core API and an Nginx-hosted frontend.
Nginx keeps the browser on one origin and proxies `/api` and `/openapi` to the API.

```bash
docker compose --profile typescript up --build
```

The `typescript` profile starts only the frontend. Its local adapter runs
`@kajay/core` in the browser.

Stop either profile with `docker compose --profile <profile> down`.

## Run from source

For the .NET profile, use two terminals:

```bash
dotnet run --project dotnet/apps/Kajay.Demo.Api --urls http://localhost:5080
VITE_KAJAY_RUNTIME=dotnet pnpm --filter @kajay/sdk-demo dev
```

For TypeScript only:

```bash
VITE_KAJAY_RUNTIME=typescript pnpm --filter @kajay/sdk-demo dev
```

Vite serves the app at <http://localhost:5174> and proxies `/api` to port 5080 in
the .NET mode.

## What the .NET profile demonstrates

The API consumes `Kajay.Core` through its public interface and exposes:

| Endpoint | SDK behavior |
| --- | --- |
| `GET /api/demo/definition` | Parse and canonicalize the embedded definition |
| `POST /api/demo/definitions/validate` | Return stable authoring diagnostics and canonical JSON |
| `POST /api/demo/answers/validate` | Run host/server validation inside the renderer's forward-navigation gate |
| `POST /api/demo/submissions` | Apply JSON answers, settle logic, advance lifecycle gates, run host/server validation, and score the quiz |
| `GET /openapi/v1.json` | Generated ASP.NET Core OpenAPI document |
| `GET /health` | Container/API liveness |

Use `blocked@example.com` in the renderer to prove that a host-supplied server
validator can reject an otherwise valid submission. A successful result includes the
`profileComplete` calculated value and the rating quiz score.

## Source map

- `apps/sdk-demo/src/features/demo/` owns the frontend feature and the narrow
  `DemoRuntime` interface.
- `HttpDemoRuntime` adapts the C# HTTP contract; `LocalDemoRuntime` adapts
  `@kajay/core` directly.
- `dotnet/apps/Kajay.Demo.Api/` owns the C# application use cases and thin endpoint
  adapter.
- `apps/sdk-demo/public/demo-survey.json` is the one authored demo definition embedded
  by the API and served by the frontend.

This is an integration example, not a third runtime contract. Cross-language semantic
compatibility remains owned by `conformance/v*/`.

## Parent and related links

- [Project context](../CONTEXT.md)
- [Demo runtime decision](./adr/0032-compose-sdk-demo-profiles.md)
- [C# SDK decision](./adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md)
