# ADR-0002 — Round-trip bar is fixed-point equivalence, not byte stability

- Area: Serialization
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

Checklist row A2 requires a lossless round-trip, and the roadmap asked whether the bar
is byte stability or structural equivalence. The answer shapes the serializer, every
fixture test, and the Creator's N5 acceptance scenario.

Byte stability on a hand-authored definition is not achievable without either never
normalizing anything or tracking authoring provenance. Real input has arbitrary key
order, explicitly written values that happen to equal defaults, and shorthand forms
(a bare string where an object is also legal).

## Decision

**Fixed-point equivalence.** A2 is proven by three rules, asserted on every fixture:

1. **Model stability** — `parse(x)` deep-equals `parse(serialize(parse(x)))`.
2. **Serialization fixed point** — `serialize(parse(x))` is byte-identical to
   `serialize(parse(serialize(parse(x))))`. The first serialization may canonicalize;
   the second and every subsequent one must not change a byte.
3. **Unknown-property preservation** — properties the registry does not declare are
   retained verbatim, re-emitted in the output, and reported through a diagnostics
   channel rather than silently dropped or silently kept.

## Supporting rules

- **Canonical form is documented and stable**: key order follows registry declaration
  order, shorthand forms expand, and properties equal to their registry default are
  elided. Eliding defaults is what makes rule 2 rather than byte-stability the right
  bar — an author who writes a default explicitly gets it normalized away on pass one,
  and never again after.
- **Expression strings round-trip verbatim.** Source text is stored as written and
  parsed lazily; it is re-printed from the AST only when the Creator's logic editor
  has semantically edited it. This keeps hand-authored formatting intact and confines
  canonical printing to the one place that needs it.
- N5 (lossless round-trip back into the Creator) follows for free: Creator output is
  always canonical, so it is already at the fixed point.

## Consequences

- The serializer needs an explicit canonicalization step with its own unit coverage,
  not just an emitter.
- Unknown-property retention is a responsibility of the element base type and the
  registry, not of individual question types — it must be impossible to write a
  question type that drops them.
- A diagnostics channel must exist in Phase 0, because A1 ("unknown properties
  surfaced, not dropped") depends on it.
- Fixtures are cheap to add and must assert all three rules; a fixture that only
  checks rule 1 hides key-order and default-elision bugs.

## Alternatives considered

- **Byte-stable on the first pass.** Rejected: forces either no normalization (leaving
  the model at the mercy of authoring style) or provenance tracking (real complexity,
  no user-visible benefit).
- **Structural equivalence alone.** Rejected as too weak: it permits a serializer that
  emits differently on every pass, which makes contract diffs and Creator saves noisy.

## Parent and related links

- [Feature-parity checklist §A1, §A2, §N5](../feature-parity-checklist.md)
- [ADR-0001](./0001-own-definition-format.md)
