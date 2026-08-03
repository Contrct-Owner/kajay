# ADR-0016 — Metadata descriptors own property defaults

- Area: Core / metadata
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

Every default was written twice. The registry declared one:

```ts
{ name: 'otherText', type: 'string', defaultValue: 'Other' }
```

and the model getter declared it again, independently:

```ts
get otherText(): string {
  const text = this.getStringProperty('otherText');
  return text.length > 0 ? text : 'Other';
}
```

Nothing checked that the two agreed. They were consistent only because one person wrote
both within a few minutes of each other, which is not a property a codebase keeps.

The duplication also encoded a second decision nobody made deliberately: because the
model's fallback triggered on an **empty** value rather than an **absent** one,
`"noneText": ""` in a definition silently became `"None"`. There was no way to author a
blank label, and no way for the model to tell "the author said nothing" from "the author
said empty".

This becomes load-bearing in Phase 2. The property grid (§K) reads the registry to
render an editor per property, and it must show the value that would apply if the author
cleared the field. Under the old shape the grid would have shown `''` where the running
model returned `'Other'` — a property editor that disagrees with the thing it edits.

## Decision

**The metadata descriptor is the only place a default is written.** `SurveyElement`
resolves an unset property through the descriptors, and the model's typed accessors
(`getStringProperty`, `getBooleanProperty`, `getNumberProperty`) return the resolved
value. Model-side `x.length > 0 ? x : fallback` fallbacks are gone.

Three consequences follow deliberately:

1. **Unset and empty are different states.** `noneText: ""` now means a blank label.
   Absent means `'None'`. This is a behaviour change in the definition format, which is
   why it is recorded here rather than in a commit message.

2. **Serialization is unaffected.** It reads `getPropertyValue` and `hasPropertyValue`,
   which stay raw and unresolved, so a default is never written into a definition and
   the ADR-0002 round-trip fixed point is untouched. This is the one place where the
   two accessor families must not be confused: `getPropertyValue` is the serializer's
   view, the typed accessors are the runtime's.

3. **Directly constructed objects resolve defaults too.** `new TextQuestion()` never
   passes through `createInstance`, so there is nothing to attach descriptors to. It
   falls back to the same model-free `*TypeDefinitions` objects that
   `registerBuiltInTypes` consumes. `SurveyElement` cannot ask `MetadataRegistry` for
   them — the registry imports the model, and the reverse import would close a cycle —
   so the definitions were lifted out of the `register*Types` functions, which now keep
   only the factories.

A registry that creates an instance stays authoritative for it. A host re-registering
`text` with its own `inputType` default gets its own default, not the built-in.

## Alternatives considered

**Leave the fallbacks in the model and drop `defaultValue` from the registry.** Rejected:
the property grid and the JSON Schema contract both need the default as *data*. A
default expressed as a `?:` in a getter is not introspectable.

**Have `SurveyElement` hold a registry reference.** Rejected: it closes the model →
registry → model cycle, and it would mean every model object carries a pointer to a
mutable global whose contents can change after construction.

**Resolve defaults at parse time by writing them into the element.** Rejected outright —
it breaks ADR-0002. Defaults written into `#values` are indistinguishable from authored
values, so the next `serializeSurvey` emits them and the round trip stops being a fixed
point.

## Consequences

- Adding a property with a default is a one-line registry change; the model getter needs
  no edit, and cannot disagree.
- The `*TypeDefinitions` objects are now the canonical serialization order (ADR-0002).
  Reordering a list there is a contract change and shows up as a diff in
  `contracts/survey-schema.json`.
- A definition that relied on `""` meaning "use the default" changes behaviour. Nothing
  ships yet, so there is no migration; if that changes before 1.0, this is the ADR to
  amend.

## Parent and related links

- [ADR-0001 — our own definition format](./0001-own-definition-format.md)
- [ADR-0002 — round-trip fixed point](./0002-round-trip-fixed-point.md)
- [Feature-parity checklist](../feature-parity-checklist.md) — §A3, §K
