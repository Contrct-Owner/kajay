# ADR-0003 — Expression language: hand-rolled tokenizer + Pratt parser

- Area: Expression engine
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

The expression language powers `visibleIf` / `enableIf` / `requiredIf` /
`setValueIf`, calculated values, triggers, and expression validators — checklist §B.
SurveyJS implements theirs with a PEG grammar and ships the generated parser.

The choice was a parser generator versus a hand-rolled recursive-descent parser.

## Decision

**Hand-rolled: a tokenizer feeding a Pratt (precedence-climbing) parser, in
`@kajay/core`, with zero runtime dependencies.** Ship a matching **printer**
(AST → canonical string) alongside it.

## Rationale

- **We need a printer, not just a parser.** Checklist M1 requires the visual logic
  editor to round-trip AST → UI → AST → string. A generator gives one direction only,
  so the printer is hand-written regardless. Hand-writing the matching parser costs
  little and keeps the two symmetric and testable against each other.
- **Zero runtime dependencies is a core invariant.** A generator means either a
  runtime dep (needs an ADR to grant) or a large committed generated file — which is
  a poor fit for `isolatedDeclarations` and `erasableSyntaxOnly`, and is unreviewable
  in a contract diff.
- **Error positions.** M2 (JSON editor error surfacing) and L2 (expression editor with
  autocomplete) both need token spans and useful partial parses. Generated parsers
  surface these poorly.
- **The grammar is small** — roughly fifteen productions. A tokenizer plus a Pratt
  parser lands in the low hundreds of lines.
- **Testability.** The guidelines require table-driven cases for every operator,
  function, and precedence rule including error paths. That is far easier over a
  tokenizer we own.

## Design constraints

- The AST is a **serializable discriminated union** — no classes, no methods on nodes
  — so it survives `isolatedDeclarations` and can cross the creator-core/UI seam.
- Every node carries a source span. Spans are what the Creator surfaces as error
  markers.
- The parser reports the first error with a position and does not throw for
  recoverable input; the logic editor must be able to render a partially valid tree.
- Printer output is canonical. Parsing then printing is idempotent, matching the
  fixed-point rule in [ADR-0002](./0002-round-trip-fixed-point.md).
- Parse results are cached by source string; expressions are parsed lazily on first
  evaluation, since [ADR-0002](./0002-round-trip-fixed-point.md) stores source text
  verbatim.
- Dependency extraction (walk the AST for `{question}` references) is part of this
  module and is what feeds [ADR-0004](./0004-explicit-dependency-graph.md).

## Consequences

- Grammar changes are ours to make and ours to get wrong; the table-driven suite is
  the safety net and must be exhaustive from the first operator.
- Composite reference paths (`{matrix.row.col}`, `{panel[0].q}`) are parsed here but
  *resolved* elsewhere — the parser produces a structured path, not a string, so the
  dependency graph can pattern-match on it.

## Alternatives considered

- **PEG generator (peggy), as SurveyJS does.** Rejected: dependency or opaque
  generated artifact, no printer, weak error positioning, and friction with the
  repo's compiler settings.

## Parent and related links

- [Feature-parity checklist §B](../feature-parity-checklist.md), §L2, §M1, §M2
- [North Star §4.1](../NORTH_STAR.md)
