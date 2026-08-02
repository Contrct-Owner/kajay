# ADR-0008 — No SurveyJS theme-JSON import; own token namespace

- Area: Theming
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

The North Star left open whether `@kajay/themes` should accept SurveyJS-compatible
theme JSON. Superficially this resembles the definition-format question
([ADR-0001](./0001-own-definition-format.md)), but the two are not alike.

The survey definition *is* the parity surface — it is the thing consumers author and
the thing the checklist is about. Theme JSON is not. Checklist I1 asks for
"CSS-variable design tokens covering all components; documented" — ours, documented by
us. I2 asks for a theme JSON format applied at runtime, not for theirs.

## Decision

**No SurveyJS theme-JSON import.** `@kajay/themes` defines its own CSS-variable token
namespace and its own theme JSON shape.

Keep the theme JSON *structurally* similar to theirs — palette, panel/panelless mode,
sizes, corner radius, background image and opacity — so that a converter remains a
small, self-contained piece of work if a real consumer ever asks for one.

## Consequences

- The token namespace is ours to design and ours to keep stable; I1's documentation
  obligation is about a surface we control.
- Accepting their theme JSON would have locked our CSS-variable names to theirs
  permanently, since a theme file is a mapping onto variable names. That constraint is
  avoided.
- A converter stays cheap because the shapes stay structurally aligned. If it is ever
  built it is a separate package or a `@kajay/themes` subpath, decided by its own ADR.
- Consistent with [ADR-0001](./0001-own-definition-format.md): we are not in the
  business of consuming SurveyJS artifacts, in either format.

## Parent and related links

- [Feature-parity checklist §I](../feature-parity-checklist.md)
- [North Star §11](../NORTH_STAR.md)
