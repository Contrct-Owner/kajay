# ADR-0044 — Version the portable human-review graph

- Area: Workflow-host definition and human work
- Status: superseded by 0045
- Owner: Jarod
- Last updated: 2026-08-08

Workflow Definition format v1 remains the immutable linear, acyclic survey/delay/effect
format. Format v2 adds a host-portable review node with three explicit transitions and
allows cycles so request-changes can open a new Survey Attempt. Review assignment is an
exact permission slug stored in the release, not a WorkOS role or user ID; the host owns
Review Tasks and authenticated decisions while Elsa owns bookmark suspension, outcomes,
and graph traversal. This preserves promotion portability and SDK independence while
allowing each environment's WorkOS roles to compose level-specific review permissions.

The consequence is that v2-capable hosts must compile a graph rather than a sequence.
Kajay uses Elsa Flowchart token execution and an explicit persisted Start node so cycles
and recovered definitions do not depend on collection ordering. Decisions commit with a
durable Workflow Resume before Elsa is invoked, and every request-changes visit creates
a new Review Round tied to the next immutable Survey Submission.

Reviewer discovery is also assignment-scoped. The tenant-wide Review Task workbench
requires the stable review capability, filters every queue query to the authenticated
principal's exact permission set, and refuses detail access when the task's assigned
permission is absent. Its detail contract resolves the immutable Submission and survey
Definition from the Workflow Instance's pinned release, so a UI never substitutes the
latest authored Definition or reconstructs review context through unrelated endpoints.

## Parent and related links

- [Project context](../../CONTEXT.md)
- [Elsa execution decision](./0043-elsa-host-workflow-engine.md)
