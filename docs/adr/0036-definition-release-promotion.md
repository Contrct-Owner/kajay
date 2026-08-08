# ADR-0036 — Promote immutable definition releases by digest

- Area: Managed definitions and environment promotion
- Status: superseded by 0045
- Owner: Jarod
- Last updated: 2026-08-08

## Context

Copying mutable definition rows or rewriting environment URLs during promotion makes
the target artifact different from the one tested in the source environment. A
standalone promotion server would also duplicate host authentication, persistence,
telemetry, and recovery before Kajay has a fleet-management requirement.

## Decision

Promotion moves an immutable, content-addressed Definition Release, never a mutable
Definition Revision or environment database row. A transport-neutral `.kajay` bundle
contains a manifest, canonical workflow definition, canonical survey definitions by
digest, and their dependency closure. It contains no environment database IDs, URLs,
secrets, buckets, or signed URLs; Environment Bindings supply those in the target.

Each workflow host contains a logically separate promotion module and management
interface. A CI/CD pipeline or `kajay` CLI publishes a release to filesystem, blob, or
OCI artifact storage, asks the target host to preflight supported formats,
conformance, extensions, dependencies, and bindings, installs idempotently by digest,
then atomically changes an Activation pointer. Source and target hosts do not call one
another. Existing Workflow Instances remain pinned; new instances resolve the active
digest. Rollback changes the pointer to an earlier installed release.

Production releases are immutable, a version label cannot name two digests, a missing
binding blocks Activation, and a release referenced by an instance cannot be deleted.
Provenance, approvals, signatures, and timestamps are records around the content
identity rather than inputs to it. A separate promotion control plane is extracted only
when one system must govern multiple independently operated hosts or independent
security, scaling, ownership, or release-lifecycle needs make that deployable earn its
cost.

## Consequences

- The exact definition content tested is the content activated.
- Promotion remains a host capability and automation workflow, not a third persistent
  application in the initial architecture.
- Artifact transport can change without changing release identity or activation rules.

## Parent and related links

- [ADR-0017 — choices URL environment portability](./0017-choices-url-environment-portability.md)
- [ADR-0034 — portable response snapshot contract](./0034-portable-response-snapshot-contract.md)
- [ADR-0035 — workflow host owns durable orchestration](./0035-workflow-host-owns-durable-orchestration.md)
