# ADR-0031 — C# SDK source and namespace architecture

- Area: Native runtime maintainability and public interface
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-06

## Context

The first complete `Kajay.Core` implementation proved the package and behavioral
seams, but placed 155 C# source files directly in one project directory and one
`Kajay` namespace. The assembly remains the correct deep module: definitions,
expressions, runtime logic, validation, and host integration are not independently
useful packages. The flat implementation nevertheless obscures locality, makes the
public namespace difficult to browse, and hides files that exceed the repository's
300-line and 50-line function limits.

`Kajay.Core` 1.0.0 has not been published to NuGet. Public namespace changes are
therefore still available without breaking a consumer, but become normal major-version
changes after publication.

## Decision

### Distribution and project seams

`Kajay.Core` remains one project, assembly, and NuGet package. Capability folders and
namespaces are implementation and discoverability tools, not new distribution seams.
No `Kajay.Core.Abstractions`, model package, or feature package is introduced.

The production project uses these public namespaces:

- **`Kajay`** — the everyday survey interface: definitions, survey sessions, values,
  question models, lifecycle, scoring, localization, and common events;
- **`Kajay.Expressions`** — standalone expression parsing/evaluation and host-defined
  expression functions;
- **`Kajay.Extensibility`** — immutable definition metadata composition and native
  question factories;
- **`Kajay.Hosting`** — cancellation-aware adapters and request/response contracts for
  remote choices and file operations;
- **`Kajay.Snapshots`** — portable response snapshot values, parsing, and version errors;
  and
- **`Kajay.Validation`** — validation state, results, errors, modes, contexts, and host
  validators.

Implementation types live beside the capability they implement. Accessibility is not
a capability, so there is no general-purpose `Internal`, `Helpers`, `Models`,
`Services`, `Abstractions`, or `Dtos` directory. A subdirectory is introduced only when
it collects several cohesive types with a shared reason to change.

The SDK-style recursive compile glob owns source inclusion; the project file does not
list ordinary `.cs` files individually. Folder and namespace conventions are recorded
in `.editorconfig` and checked in the native verification chain.

### Source responsibilities

The root project directory contains project infrastructure and the small `Kajay`
golden-path interface. Specialized implementation is grouped under `Definitions`,
`Expressions`, `Extensibility`, `Hosting`, `Runtime`, `Snapshots`, and `Validation`, with narrower
subdirectories for choices, files, questions, logic, localization, patterns, and
values where the cluster is large enough.

Moving files is not sufficient when a file still contains multiple responsibilities.
`Survey` is split into cohesive partial declarations while retaining one public type.
Validation keeps one public state owner and delegates pure built-in rule evaluation to
an internal engine. Definition parsing keeps one deep entry module and extracts
property/child reading where needed. The 300/50 limits apply to C# and are enforced
rather than documented only.

### Tests, benchmarks, and samples

`Kajay.Core.Tests` mirrors production capabilities and primarily tests the public
interface. The small number of intentional implementation tests live in a distinct
`Kajay.Core.Internal.Tests` project with friend access. Conformance tests have no friend
access and adapt the corpus through public interfaces only.

Calibrated wall-clock and allocation measurement lives in the non-packable
`Kajay.Core.Benchmarks` console project. Deterministic scale and independence
assertions remain in the ordinary test suite. A buildable
`Kajay.Core.GettingStarted` sample is the source of the shortest documented consumer
path; installed-package smoke remains the distribution proof.

### Compatibility

The namespace move intentionally replaces the unpublished 1.0 API baseline. The
package remains version `1.0.0`; pretending the unreleased layout was a public
predecessor would create migration ceremony without a consumer. After publication,
namespace and assembly identities follow the breaking-change policy in ADR-0030 and
normal semantic versioning.

## Consequences

- Maintainers navigate by behavior and change locality instead of a 155-file list.
- Everyday consumers start with `using Kajay;`; specialized capabilities require only
  the namespace they use.
- The package remains deep and BCL-only at runtime.
- Tests can no longer make a conformance claim through implementation-only types.
- Namespace moves create a large but intentional shipped-interface diff before the
  first NuGet publication.
- Structural drift becomes a build failure.

## Alternatives considered

- **Folders only, with every type in `Kajay`.** Rejected because it improves source
  navigation but leaves the public interface undifferentiated and cannot enforce the
  intended namespace structure.
- **One namespace or project per small feature.** Rejected because it replaces one
  flat list with shallow seams and import/package fragmentation.
- **Separate all public and internal files.** Rejected because related implementation
  would be moved away from the interface it serves.
- **Delay until after publication.** Rejected because namespace identity would then be
  a consumer-breaking change.

## Parent and related links

- [ADR-0030](./0030-native-csharp-sdk-and-v2-runtime-semantics.md)
- [Library development guidelines](../library-development-guidelines-details.md)
- [C# parity ledger](../feature-parity-checklist.md#q--c-headless-sdk)
- [.NET namespace guidance](https://learn.microsoft.com/dotnet/csharp/fundamentals/program-structure/namespaces)
- [IDE0130](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/style-rules/ide0130)
