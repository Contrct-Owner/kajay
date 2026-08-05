# Headless semantics and React adapter contract

- Area: Architecture and verification
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-04

The survey and Creator models are the deep modules. Their public package entries are
the interfaces through which a React, Vue, Angular, server, or test adapter reaches
definition semantics. `@kajay/react` and `@kajay/creator-react` sit at rendering and
composition seams: they translate browser events, DOM geometry, focus, accessibility,
and host components into calls on those interfaces.

That boundary cannot be proven by banning words, conditionals, helper functions, or
large files in React source. Event translation and accessible rendering contain real
logic, while a misplaced validation rule can be written in one innocent-looking line.
Such a static ban would be both brittle and stronger in wording than in fact.

## Enforced proof convention

Every green acceptance row with an enabled real-browser proof in a UI package must
also have an enabled unit proof in a framework-independent package for the same row.
The unit proof exercises the semantic interface without React or the DOM; the browser
proof exercises the adapter's translation of that interface into observable UI.

The paired proof gives semantic behavior locality in the headless module and leverage
across future framework adapters. It also makes the rendering seam replaceable: a new
adapter has an executable behavior to call rather than React behavior to copy.

Some acceptance rows specify the adapter itself. Those rows are listed below with the
browser-owned responsibility that makes a headless proof dishonest. The parity-proof
gate fails when a React-backed row has neither a framework-independent proof nor one
of these decisions. It also fails stale exceptions after a headless proof is added.

## Adapter-owned acceptance rows

| Row | Adapter-owned responsibility |
| --- | --- |
| A4 | Dispatching a registered page element to a host-supplied React component. |
| F6 | Choosing and drawing the responsive table or grouped-list DOM layout. |
| I4 | Applying host CSS-part overrides to rendered markup. |
| I5 | CSS layout, visually hidden accessible names, and their DOM representation. |
| I6 | Substituting the React renderer used for authored text. |
| P2 | Replacing native React controls through the host component map. |
| P4 | Menu markup, focus movement, dismissal, and keyboard event translation. |
| P7 | Allocating React-instance DOM ids and connecting labels to controls. |
| P9 | Supplying the public React furniture required by a host renderer. |
| P10 | Translating content-editable focus, blur, and Escape into existing Creator edits. |
| P11 | Placing the type picker in the React property-grid composition. |

## What this proves

The gate proves that every accepted capability observed through React is executable
through a framework-independent module interface, unless the acceptance row explicitly
defines browser or React behavior. It does not prove the absence of duplicated semantics
inside an adapter, and it does not replace review of where a new decision belongs.

When a feature mixes semantic and adapter behavior, give the row both proofs. Add an
exception only when the whole accepted responsibility is about rendering, composition,
DOM identity, focus, geometry, or browser-event translation. A rationale that merely
says “implemented in React” is not a reason: move the meaning headlessly first.

## Related decisions

- [North Star §4](./NORTH_STAR.md#4-architecture--the-package-graph)
- [ADR-0009](./adr/0009-creator-drag-and-drop.md)
- [ADR-0019](./adr/0019-deep-runtime-modules-and-rendering-seam.md)
- [ADR-0021](./adr/0021-creator-composition.md)
