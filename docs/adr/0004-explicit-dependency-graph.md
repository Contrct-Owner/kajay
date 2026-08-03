# ADR-0004 — Core reactivity: explicit dependency graph, no signals library

- Area: Core runtime
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

Checklist B8 requires that a value change re-evaluate only its dependents, and that
cycles be **detected and reported**. The options were an explicit dependency graph we
own, or an off-the-shelf signals library providing automatic dependency tracking.

## Decision

**An explicit dependency graph in `@kajay/core`, with zero runtime dependencies.**

## Rationale

- **We are not building auto-tracking, so the graph is nearly free.** Dependencies
  fall out of the expression AST statically — the parser already walks it to collect
  `{question}` references ([ADR-0003](./0003-hand-rolled-expression-parser.md)). The
  main value proposition of a signals library is the tracking we do not need.
- **B8 demands cycle *reporting*, not just detection.** A graph we own can name the
  participating nodes in the error. Signals libraries typically throw a generic cycle
  error or silently glitch.
- **Zero runtime dependencies in core** is an invariant; adopting a library would
  require an ADR granting an exception, and the benefit does not justify it.
- **Test determinism.** A signals runtime with async batching makes evaluation order
  and event timing implicit, which is in direct tension with the parallel-first,
  order-independent test policy. An explicit graph with synchronous topological
  recompute is pure logic and exhaustively unit-testable.
- **Adapter portability.** Exposing subscribe + version keeps the core framework-
  neutral; React 19's `useSyncExternalStore` maps onto it directly, and Vue/Angular
  adapters stay possible. A signals library would leak its own reactivity model into
  every adapter.

## Design constraints (resolved 2026-08-02)

These are the genuinely hard parts. They were named here so the Phase 1 design did not
discover them late; each is now built and covered by `parity/B8-*` suites.

**How they were resolved.** Pattern edges became a `DependencyPattern` whose index
segments may be a wildcard, matched prefix-wise in *both* directions — so replacing a
collection invalidates readers of its elements, and changing an element invalidates
readers of the whole. Instances materialised at runtime need no new edge registration.
The transaction model orders by declared writes in a single pass, and only *undeclared*
writes re-enter, bounded by a cascade limit that names the nodes still churning. Cycle
errors carry the participating node keys in the order they close the loop, which fell
out of choosing DFS over Kahn's algorithm: the visiting stack is the cycle.

One thing the tests caught that the design here did not anticipate: a node reading what
it writes — `total = total + 1` — is a cycle of one, and the obvious "a node is not its
own predecessor" guard silently let the single most likely authoring mistake through.

- **Pattern edges for dynamic collections.** `{matrix.row.col}` and `{panel[0].q}`
  cannot be static edges — rows and panels are created and destroyed at runtime. The
  graph needs edges that match a *path pattern* (e.g. all rows of a matrix for a given
  column) and materialize concrete edges as instances appear.
- **A transaction model.** One value change produces a topologically ordered
  recompute followed by a single round of events — not a cascade of interleaved
  events. Triggers can set values that fire further triggers, so the transaction needs
  a cascade fuel limit that reports where it ran out rather than hanging.
- **Cycle errors name the path**, not just the fact of a cycle.
- **Invalidation is push-based and synchronous.** No scheduler, no microtask batching
  in core; if an adapter wants frame-level batching it does that at the adapter.

## Consequences

- Core owns a piece of infrastructure that a library would have supplied — accepted,
  because it is small, static, and central to a checklist acceptance row.
- The graph is the natural place to enforce B8's cycle reporting and E9's
  clear-invisible-values policies, since both are questions about dependents.

## Alternatives considered

- **A signals library.** Rejected on the dependency invariant, cycle-reporting
  quality, and test determinism grounds above.

## Parent and related links

- [Feature-parity checklist §B8, §B6, §B7, §E9](../feature-parity-checklist.md)
- [North Star §4.1](../NORTH_STAR.md), [ADR-0003](./0003-hand-rolled-expression-parser.md)
