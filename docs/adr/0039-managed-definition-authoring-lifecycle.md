# ADR-0039 — Draft, checkpoint, then assemble a Definition Release

- Area: Managed Definition authoring and release creation
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

The workflow host can install and activate immutable `.kajay` releases, but an editor
cannot safely begin with a ZIP archive. Creator needs a durable working document,
concurrent edits must not overwrite one another, and the release must be assembled
from a named saved state rather than whatever mutable bytes happen to exist when a
button is pressed. None of those host lifecycle concerns belong in `Kajay.Core`.

## Decision

A Managed Definition owns one mutable Draft and zero or more immutable Definition
Revisions. Draft saves parse through `Kajay.Core`, store canonical definition JSON and
its Definition Digest, require an `If-Match` version, and append host audit facts. A
stale save fails with `412`; invalid survey semantics fail with `422` and are never
persisted.

Checkpointing the current Draft creates one immutable Revision for that Draft version.
Repeating the checkpoint is idempotent and returns the same Revision. Release creation
names a Revision and a version label; the host, not the browser, assembles and installs
the deterministic `.kajay` bundle through the existing promotion module.

The first authoring assembler deliberately creates a linear `survey → end` workflow
around the Revision's one survey. Multi-survey workflow authoring will extend Revision
content and the assembler behind the same interface; it does not require Creator to
learn ZIP layout, digest derivation, or release persistence.

The SDK demo exposes this as a separate `definition-authoring` frontend feature. Its
HTTP client and runtime response validation stay outside presentational Creator code.
The workflow Compose profile serves that frontend and proxies the authenticated host
on the same browser origin.

## Consequences

- Creator auto-save has one optimistic-concurrency interface and cannot silently
  overwrite another editor.
- A Release is reproducible from an immutable Revision and remains content-addressed.
- Drafts, revisions, audit, WorkOS permissions, and PostgreSQL remain host concerns;
  the `Kajay.Core` SDK interface is unchanged.
- Revision listing, collaborative merge, and multi-survey workflow design are explicit
  later capabilities, not accidental properties of the initial save route.

## Parent and related links

- [ADR-0035 — workflow host owns durable orchestration](./0035-workflow-host-owns-durable-orchestration.md)
- [ADR-0036 — promote immutable definition releases](./0036-definition-release-promotion.md)
- [Workflow host guide](../workflow-host.md)
