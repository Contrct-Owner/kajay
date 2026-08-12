# @kajay/core

Headless TypeScript survey runtime, metadata registry, expression engine, validation,
navigation, and serialization for Kajay definitions.

## Install

```bash
npm install @kajay/core
```

## Parse and run

```ts
import { parseSurvey } from '@kajay/core';

const { diagnostics, model } = parseSurvey({
  schemaVersion: 1,
  pages: [{ name: 'main', elements: [{ type: 'text', name: 'email' }] }],
});

model.setValue('email', 'person@example.com');
await model.nextPageOrComplete();
console.log(diagnostics, model.data);
```

The JSON definition is authoritative. Build one model per respondent session and use
the returned diagnostics to report recoverable authoring problems.

## Compatibility and documentation

- TypeScript 5.5 and later consumers are tested.
- Node 22.12 and later is supported.
- Published TypeScript 1.x claims survey schema v1 and runtime conformance v1.
- [Runtime quickstart](https://kajay.io/docs/quickstart/runtime)
- [Generated API reference](https://kajay.io/docs/reference/api/core)
- [Repository SDK overview](https://github.com/Contrct-Owner/kajay/blob/main/docs/sdk-summary.md)

MIT licensed. See `CHANGELOG.md` for release history.
