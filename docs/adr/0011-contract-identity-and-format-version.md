# ADR-0011 — Contract identity and definition-format versioning

- Area: Schema contract
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

`contracts/survey-schema.json` is generated from the metadata registry, committed, and
drift-checked (checklist A6). Two things about it were undecided: whether it carries a
stable `$id` that external validators can pin, and — a question the corpus had not
asked at all — whether the survey definition itself records which version of the
format it was authored against.

The second question got sharper with
[ADR-0001](./0001-own-definition-format.md). Because the format is ours and
[ADR-0005](./0005-single-version-train.md) keeps the project on `0.x` through Phase 2,
breaking format changes are expected. Without a version marker, a definition authored
against an older format fails as a confusing parse error somewhere deep in the
registry rather than as a clear statement of what went wrong.

## Decision

### The contract carries `$schema` and a URN `$id`

- `"$schema": "https://json-schema.org/draft/2020-12/schema"`.
- `"$id": "urn:kajay:survey-definition:1"`, where the trailing integer is the
  **format major version**, not the package version.

A URN rather than an `https` URI, deliberately. `$id` is an identifier, not a
fetch target, and it must never change once anything pins it. An `https` `$id`
would require committing now to a domain the project does not own, while
[ADR-0007](./0007-license-and-repo-posture.md) keeps the repo private and the public
posture explicitly undecided. A URN carries no such dependency.

If the project later goes public, serve the schema at a resolvable URL by all means —
that is orthogonal, and the `$id` stays exactly as it is. Never migrate `$id` to a
domain-based URI just because a domain becomes available; the identifier's only job is
to be stable.

### The definition records its format version

The root survey object carries an optional `schemaVersion` integer matching the
`$id`'s major. Parser behavior is:

| Input | Behavior |
| --- | --- |
| Absent | Assume current. Definitions authored by hand stay terse. |
| Equal to current | Parse normally. |
| Older, known | Migrate, and report the migration through the diagnostics channel. |
| Newer, or older and unknown | **Refuse**, with an error naming both versions. Never parse on a best-effort basis. |

`schemaVersion` is always emitted in canonical output, so anything the serializer
writes is self-describing even though hand-authored input need not be.

**Pre-1.0 policy:** no migrations are written. The field exists so the *error* is
good — "authored for format v2, this build supports v1" instead of an unexplained
failure on an unknown property. Migrations become possible at 1.0 without a format
change, which is the entire point of adding the field before it is needed.

## Consequences

- `schemaVersion` is part of the canonical form, so it participates in the fixed-point
  rule in [ADR-0002](./0002-round-trip-fixed-point.md): a definition without it gains
  it on the first serialization pass and is byte-stable from the second onward.
- The format major version is now a thing that can be incremented, which means
  incrementing it is a decision with an ADR — not something that happens implicitly
  because a property was renamed.
- The drift check gains a second assertion: the committed contract validates against
  the 2020-12 meta-schema, so a registry bug cannot commit a malformed schema.
- Refusing newer definitions rather than best-effort parsing is a deliberate choice
  against silent data loss, consistent with A1's "surfaced, not dropped".

## Parent and related links

- [Feature-parity checklist §A1, §A6](../feature-parity-checklist.md)
- [North Star §4.4](../NORTH_STAR.md), [ADR-0001](./0001-own-definition-format.md),
  [ADR-0002](./0002-round-trip-fixed-point.md)
