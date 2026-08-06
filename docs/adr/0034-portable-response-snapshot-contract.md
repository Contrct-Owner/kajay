# ADR-0034 — Portable, definition-bound response snapshots

- Area: Runtime persistence and cross-language compatibility
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

TypeScript's `SurveyProgress` stores answers and a page name, while the C# runtime has
no equivalent. That shape loses an instant's type when it crosses JSON, cannot resume
timers or lifecycle state, and can be restored against a different definition without
being noticed. Workflow persistence would otherwise have to invent incompatible
runtime-specific formats outside the SDKs.

## Decision

Define Response Snapshot Format v1 independently of the survey schema and conformance
versions. Both maintained runtimes expose the same JSON-safe snapshot containing its
format version, `sha256:` Definition Digest, conformance version, recursively tagged
Kajay values, authored page name, respondent locale, durable lifecycle, and optional
absolute UTC survey/page timer anchors. Answers restore before page selection because
answers determine page visibility. A missing or hidden page resolves to the first
effective page.

The durable lifecycle is `empty`, `running`, `preview`, or `completed`. `loading` is
host-owned transient work and cannot be captured. Restore validates the whole snapshot,
including its definition identity, before changing a Survey; it rehydrates without
emitting value, navigation, locale, completion, or lifecycle events. Offline time
counts: a restored running timer continues from its original UTC anchors and applies
expiry on the next explicit host tick.

Definition Digests are lowercase SHA-256 over the UTF-8 canonical definition JSON.
Canonical definition bytes are therefore a cross-runtime contract, not merely
semantically equivalent JSON. The digest uses the `sha256:<64 hex digits>` spelling.

The published TypeScript `SurveyProgress` interface and its existing behavior remain
available for 1.x consumers. Response Snapshot is the durable cross-runtime seam; new
hosts do not persist `SurveyProgress`.

## Consequences

- A host can store one opaque JSON document and restore it in either runtime.
- Text that looks like a date remains text, while a runtime instant remains an instant,
  including inside arrays and objects.
- A snapshot cannot silently resume against edited survey semantics.
- Rehydration cannot accidentally resubmit a completed response or replay autosave and
  audit handlers.
- Tenant IDs, workflow IDs, row versions, ETags, idempotency keys, audit metadata, and
  retention policy remain in the host persistence envelope.

## Parent and related links

- [ADR-0020 — versioned cross-language runtime contract](./0020-versioned-cross-language-runtime-contract.md)
- [ADR-0030 — native C# SDK and v2 runtime semantics](./0030-native-csharp-sdk-and-v2-runtime-semantics.md)
- [ADR-0035 — workflow host owns durable orchestration](./0035-workflow-host-owns-durable-orchestration.md)

