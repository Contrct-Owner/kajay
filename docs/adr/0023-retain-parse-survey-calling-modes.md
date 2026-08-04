# ADR-0023 — Retain both `parseSurvey` calling modes

- Area: Core serialization interface
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

## Context

`parseSurvey` accepts either host options as its second argument or a concrete metadata
registry followed by host options. Dispatch through `instanceof MetadataRegistry` is
unusual enough to warrant review before the public surface is finalized.

The repository has 209 direct TypeScript calls: 48 use only the definition, 150 use a
second argument, and 11 use three arguments. The options-only form has production host
and preview callers. Registry-only calls dominate isolated tests and are also used by
Creator document/session code. Ten direct callers need both a registry and options.
Pack-consumer and conformance fixtures exercise the default-registry forms as well.

## Decision

Retain the two current calling modes:

```ts
parseSurvey(definition, options?)
parseSurvey(definition, registry, options?)
```

The two forms represent real caller choices. Replacing them now with a single options
bag would temporarily add a third form and a migration surface without removing
meaningful consumer complexity. The concrete-class dispatch is acceptable while
`MetadataRegistry` remains a package-owned class and no structural or cross-realm
registry adapter is supported.

Structural root failures continue to throw `TypeError` or
`UnsupportedSchemaVersionError`; recoverable definition problems continue to return
diagnostics. Passing option objects in both positional option slots is not a supported
calling mode; the third argument exists for the registry form and for the legacy
`undefined` registry placeholder.

## Reconsideration trigger

Reconsider one TypeScript-5.5-safe options bag before a public 1.0 release, or when any
of these becomes true:

- a second parser-owned concern beyond registry selection is added;
- cross-realm or duplicate-package registry use is demonstrated; or
- at least three non-test callers need registry plus survey options.

At that trigger, keep legacy calls for a documented migration window, reject ambiguous
options-plus-options calls explicitly, prove old and new declarations across the
TypeScript 5.5/6/7 pack matrix, and remove positional dispatch only in a breaking
release.

## Alternatives considered

- **One options bag immediately.** Rejected because it enlarges the transition surface
  before caller pressure justifies it.
- **Extract argument resolution into its own module.** Rejected by the deletion test:
  it would be a one-caller pass-through whose removal restores only a few local lines.
- **Remove registry injection.** Rejected because isolated registries are fundamental
  to deterministic tests and Creator document/session behavior.

## Parent and related links

- [ADR-0014 — supported TypeScript range](./0014-supported-typescript-range.md)
- [Library development guidelines](../library-development-guidelines-details.md)
- [Architecture remediation plan](../architecture-remediation-plan.md)
