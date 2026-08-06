# Changelog

All notable changes to `Kajay.Core` are recorded here. The NuGet package versions
independently from the Kajay TypeScript packages.

## Unreleased

### Added

- Definition-bound Response Snapshot Format v1 capture, JSON parsing, and silent
  restore through `Survey.CreateSnapshot`, `SurveySnapshot.Parse`, and
  `Survey.RestoreSnapshot`.
- Recursively tagged values preserve absent, JSON scalar, UTC instant, array, and object
  values across process and language boundaries.
- Shared TypeScript/C# snapshot conformance, installed-package coverage, timer-anchor
  persistence, and lowercase SHA-256 definition identities.

## [1.0.0] - 2026-08-05

First stable release.

### Added

- Native .NET 10 headless runtime for survey schema v1 and conformance v1/v2.
- Canonical definition parsing, diagnostics, expressions, dependency settlement,
  validation, navigation, lifecycle, timers, scoring, localization, and question models.
- Cancellation-aware host seams for remote choices, async functions, validation, and
  file upload, download, and cleanup.
- Immutable metadata and native question-factory registry for host extensions.
- Embedded generated contracts and public supported-version discovery.
- Source Link and symbol packages, trimming and Native AOT analysis, installed-package
  smoke coverage, and a shipped public API compatibility baseline.

### Compatibility and migration

- This release has no stable predecessor. Consumers of development builds must recompile
  against 1.0.0 and treat the shipped API baseline as the stable surface going forward.
- `Kajay.Core` versions do not track `@kajay/core` versions. Select interoperability by
  the declared schema and conformance versions exposed through `KajayContracts`.
- The minimum supported target is .NET 10. Survey instances are mutable, single-owner,
  and not thread-safe; immutable definitions and registries may be reused concurrently.
