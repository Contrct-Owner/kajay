# Response Snapshot Format v1

- Area: Durable response portability
- Status: passing in TypeScript and C#
- Owner: Jarod
- Last updated: 2026-08-06

This corpus is the adapter-neutral executable contract for
[ADR-0034](../../../docs/adr/0034-portable-response-snapshot-contract.md). Its version
is independent of the survey definition schema and runtime conformance versions.
`snapshot.schema.json` is the machine-readable storage shape; runtime parsers additionally
enforce semantic constraints such as valid calendar instants and timer ordering.

Each case creates a survey from `definition`, applies the recursively tagged
`answers`, navigates to `pageName`, applies `locale` and `lifecycle`, then compares the
captured JSON value with `expected`. The same expected value must be emitted by every
runtime. A case may provide an explicit `clock` and `startTimer` so absolute timer
anchors are compared without depending on a machine clock. Tagged values distinguish
absent, JSON scalar, UTC instant, array, and object values so host JSON libraries cannot
erase runtime types.
