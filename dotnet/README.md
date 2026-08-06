# Kajay.Core

`Kajay.Core` is the native, headless Kajay survey runtime for .NET. It parses and
canonicalizes Kajay definitions, runs survey logic, exposes typed question models,
validates and scores responses, and integrates host-owned I/O without depending on a UI
framework or transport library.

The package targets .NET 10 and later and has no runtime dependencies outside the BCL.

## Install

After the package is published to NuGet.org:

```shell
dotnet add package Kajay.Core --version 1.0.0
```

## Parse and run a survey

```csharp
using Kajay;

const string json = """
{
  "pages": [
    {
      "name": "contact",
      "elements": [
        { "type": "text", "name": "email", "isRequired": true }
      ]
    }
  ]
}
""";

SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(json);
foreach (DefinitionDiagnostic diagnostic in parsed.Diagnostics)
{
    Console.WriteLine($"{diagnostic.Severity}: {diagnostic.Code} at {diagnostic.Path}");
}

Survey survey = parsed.Definition.CreateSurvey();
survey.SetValue("email", KajayValue.From("person@example.com"));

using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(10));
SurveyAdvanceOutcome outcome = await survey.AdvanceAsync(cancellation.Token);
IReadOnlyDictionary<string, KajayValue> response = survey.Data;
```

`SurveyDefinition` is immutable and reusable. Each `CreateSurvey` call returns an
independent mutable session. A `Survey` instance has one logical owner and is not
thread-safe; do not mutate one instance concurrently.

## Persist and resume

```csharp
using Kajay;
using Kajay.Snapshots;

SurveyDefinition definition = SurveyDefinition.Parse(json).Definition;
Survey source = definition.CreateSurvey();
source.SetValue("email", KajayValue.From("person@example.com"));

string storedJson = source.CreateSnapshot().ToJson(); // store with host metadata

Survey restored = definition.CreateSurvey();
restored.RestoreSnapshot(SurveySnapshot.Parse(storedJson));
```

Response Snapshot Format v1 binds answers, page, locale, durable lifecycle, and timer
anchors to `definition.DefinitionDigest`. Restore rejects the wrong definition before
mutation and does not replay runtime events. Kajay owns this portable value contract;
the host owns database keys, workflow state, tenancy, encryption, retention, optimistic
concurrency, and promotion between immutable definition releases.

The complete buildable version of this path lives in
[`samples/Kajay.Core.GettingStarted`](./samples/Kajay.Core.GettingStarted).

## Namespaces and source layout

The SDK remains one assembly and one NuGet package. `using Kajay;` contains the normal
survey workflow. Specialized interfaces are grouped in `Kajay.Expressions`,
`Kajay.Extensibility`, `Kajay.Hosting`, `Kajay.Snapshots`, and `Kajay.Validation`.
Source and tests mirror those capabilities; implementation detail is kept beside the
capability it serves instead of in generic `Helpers`, `Models`, or `Services`
directories.

From this directory, run the getting-started sample or the calibrated benchmark suite:

```shell
dotnet run --project samples/Kajay.Core.GettingStarted --configuration Release
dotnet run --project benchmarks/Kajay.Core.Benchmarks --configuration Release
```

## Runtime capabilities

- canonical schema-v1 definition parsing with recoverable author diagnostics;
- Kajay expressions, calculated values, conditions, triggers, timers, and lifecycle;
- required, built-in, expression, custom, asynchronous, and server validation;
- scalar, choice, matrix, dynamic-record, file, and signature question models;
- scoring, localized authored text, locale fallback, and portable Kajay patterns;
- endpoint and lazy choices, async expression functions, and file transfer adapters;
- immutable metadata/factory registries for native custom question types; and
- explicit clocks and cancellation-aware task-based host operations.

Host applications provide I/O through delegates on `SurveyOptions`. Kajay does not own
HTTP clients, persistence, credentials, retry policy, or UI. Use `CreateSurveyAsync` and
the asynchronous navigation APIs when configured choices, functions, validation, or
file operations can perform host work.

## Definitions and compatibility

The JSON survey definition is the authority. `KajayContracts` exposes the embedded
schema, metadata and diagnostics contracts, plus the supported schema and conformance
versions. Kajay package versions are language-specific: compatibility between
`Kajay.Core` and `@kajay/core` is established by a shared conformance version, not by
matching NuGet and npm version numbers.

`Kajay.Core` 1.0.0 supports survey schema v1 and conformance v1 and v2. It rejects an
unsupported declared schema version instead of guessing. Definition property names and
answer names are ordinal and case-sensitive; expression and locale rules follow the
versioned Kajay contract rather than current process culture.

## Extensions

Build a `SurveyDefinitionRegistry` before parsing when a host owns custom metadata or a
native question implementation. Registries are immutable: composition returns a new
registry, so a configured registry can safely be reused across definitions and parallel
survey sessions. Extension factories receive a `SurveyQuestionFactoryContext`; custom
host work should follow the same task, cancellation, and explicit-clock conventions as
built-in adapters.

## Release and support contract

The public API is locked by the shipped API baseline. Releases build with nullable
analysis, warnings-as-errors, package validation, Source Link, trimming analysis, and
Native AOT analysis. Pack verification installs the generated `.nupkg` into a fresh
consumer and compiles and executes its public scenarios.

The supported-scale workloads, performance budgets, runtime support window, and security
response targets are specified in
[ADR-0030](https://github.com/Contrct-Owner/kajay/blob/main/docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md).
See the packaged `CHANGELOG.md` for release history and migration notes.

`Kajay.Core` is licensed under the MIT License.

## Workflow host reference

`apps/Kajay.Workflow.Host` is a separate host application, not part of the NuGet SDK.
It demonstrates PostgreSQL-backed Response Snapshot persistence, workflow instances,
ETag concurrency, idempotent commands, audit facts, durable timers, transactional
outbox delivery, immutable Definition Release promotion, and WorkOS AuthKit-backed
organization identity and permissions. See the
[workflow host guide](../docs/workflow-host.md) for its Compose profile, routes, bundle
format, and production integration seams.
