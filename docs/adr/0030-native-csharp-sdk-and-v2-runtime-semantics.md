# ADR-0030 — Native C# SDK and v2 runtime semantics

- Area: Native runtimes, SDK distribution, and cross-language behavior
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-05

## Context

`@kajay/core` 1.0.0 is published and the next maintained runtime is C#. ADR-0020
already requires a native runtime to implement the embedded headless core behind the
versioned conformance seam, but it deliberately did not choose the .NET package shape
or turn JavaScript implementation accidents into cross-language rules.

The first C# implementation forces those choices. JavaScript and .NET disagree about
regular expressions, dates, numeric conversion, string conversion, equality, sorting,
and rounding. Copying the TypeScript results would preserve behavior such as unrelated
objects comparing equal through `"[object Object]"`, hexadecimal strings acting like
numbers, booleans participating in arithmetic, implementation-dependent date parsing,
and midpoint rounding that changes with the host language. Those are not suitable
interfaces for two maintained runtimes.

## Decision

### Native package and compatibility

The native SDK is one deep NuGet package and assembly named **`Kajay.Core`**. It targets
`net10.0`; .NET 10 is the minimum supported runtime, and later stable .NET runtimes are
supported through normal framework compatibility. It does not target .NET Framework,
.NET Standard, or a pre-.NET-10 runtime.

The NuGet package versions independently from the TypeScript package. Each release
declares the survey schema versions and conformance versions it implements. Package
version equality never implies runtime compatibility; passing the named conformance
version does.

The package owns the whole headless runtime behind one public seam. Definition parsing,
metadata, expression evaluation, dependency planning, validation, navigation, timers,
scoring, and localization remain internal modules rather than separate NuGet packages.
Namespaces may organize the interface, but do not create additional distribution seams.
UI, Blazor rendering, Creator, persistence, HTTP transport, and response hosting are not
part of `Kajay.Core`.

The implementation uses the BCL only at runtime unless a later ADR grants a dependency.
It enables nullable reference types, warnings as errors, deterministic builds, package
validation, Source Link, symbols, trimming analysis, and Native AOT analysis. The first
stable package establishes the API compatibility baseline for later versions. Host I/O
is asynchronous, uses the task-based pattern, and accepts `CancellationToken`. Survey
instances are mutable and not thread-safe; immutable
contracts and registries may be reused, and independent survey instances must not share
mutable state.

### Conformance v2 and release versions

The semantic corrections below create **conformance v2**. V2 retains definition
canonicalization, expression parsing, and expression evaluation, and replaces v1's
narrow lifecycle operation with one general **survey scenario** operation. Scenario
actions and observations cover lifecycle, answers, validation, scoring, and future
headless behavior without growing one adapter operation per feature.

V2 inherits every compatible v1 case, while its README and cases supersede v1 rules
where this ADR changes behavior. V1 stays committed for the published TypeScript 1.x
train. The v2 corpus is specified before either runtime implements it and is not added
to the passing-adapter claim until an adapter actually passes.

Changing the TypeScript behavior described here is a breaking change. It ships as
`@kajay/core` 2.0.0, not a 1.x patch. The independently versioned C# package may begin
at 1.0.0 only after its required C# parity rows, package gates, and conformance v2 pass.

### Kajay values

The expression language operates on this closed value algebra:

```text
absent | null | boolean | finite binary64 number | string |
UTC instant | array | object
```

An answer map distinguishes an absent key from a key whose JSON value is `null`.
Expressions deliberately retain `absent == null` for author convenience, but storage,
events, serialization, and host interfaces preserve the distinction.

Equality follows the value kinds instead of host-language string conversion:

- finite numbers compare numerically;
- a number and a valid numeric string compare numerically;
- booleans compare only with booleans;
- strings otherwise compare ordinally by UTF-16 code units;
- UTC instants compare by epoch milliseconds;
- arrays compare recursively and in order;
- objects compare recursively by exact ordinal property names, ignoring property order;
- different kinds are unequal except for numeric-string coercion and absent/null; and
- cycles and values outside the algebra are rejected at an extension seam.

Ordering is defined only for two numeric operands, two strings, or two UTC instants.
A valid numeric string is numeric when paired with another numeric operand. Arrays,
objects, booleans, null, and absent are not orderable. No expression operation converts
an array or object to text implicitly.

Emptiness and truthiness are also Kajay rules. Absent, null, the empty string, and an
empty array are empty; no other value is. Absent, null, false, numeric zero, the empty
string, and an empty array are false. Every other supported value is true, including a
non-empty numeric string, a UTC instant, and an object with no properties.

Numeric strings use one invariant decimal grammar with an optional sign, fraction, and
base-ten exponent. Contract-defined leading and trailing whitespace is ignored. Empty,
hexadecimal, binary, octal, locale-formatted, non-finite, and boolean values are not
numeric. Arithmetic returning a non-finite binary64 value produces absent rather than a
non-JSON number.

Text conversion, where an operation explicitly permits it, is invariant: booleans are
lowercase, numbers use canonical finite binary64/JSON spelling, and instants use UTC ISO
text. Rounding uses midpoint-away-from-zero and normalizes negative zero at a contract
serialization seam.

### Dates and instants

Date input accepts only:

- `YYYY-MM-DD`, interpreted as midnight UTC; or
- an ISO date-time with an explicit `Z` or numeric offset and one to three optional
  fractional-second digits.

An accepted date-time normalizes to a UTC instant with millisecond precision. Local
date-times without an offset, host-culture formats, rollover dates, and other
implementation-dependent inputs are invalid. Date functions always use the explicit
evaluation clock and UTC calendar fields.

### Text, casing, sorting, and URL values

Expression identifiers and function names use the ASCII grammar and compare
ASCII-case-insensitively where the language says names are insensitive. Definition
property names, answer names, and ordinary strings remain exact and case-sensitive.
Locale tags compare ASCII-case-insensitively and fallback by removing the final BCP 47
subtag before using `default`.

Case-insensitive respondent search uses Unicode 17.0 Default Case Folding without
normalization. A generated folding table must be committed as a conformance resource
before either adapter claims v2 rather than using whatever Unicode data the host
runtime ships. Authored choice order is preserved. An explicitly requested ascending
or descending choice sort uses ordinal UTF-16 order, with original order breaking ties,
rather than current culture.

Values substituted into URL query/path placeholders use UTF-8 RFC 3986 percent encoding:
only `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, and `~` remain unescaped. Deployment endpoint
placeholders remain host-supplied URL components and are substituted verbatim under
ADR-0017. Interpolation and display formatting use the invariant scalar conversions
above and define collection formatting at the owning feature; they never call a host
object's default `ToString`/string conversion.

### Kajay Pattern Profile v1

The `regexvalidator.regex` property contains a **Kajay pattern**, not an ECMAScript or
.NET regular expression. Pattern Profile v1 supports literals and escaped literals,
dot, character classes and ranges, negated classes, defined `\d`/`\w`/`\s` classes and
their inverses, start/end anchors, grouping, alternation, and the `*`, `+`, `?`, `{n}`,
and `{n,m}` quantifiers. Matching searches unless anchored and is case-sensitive.

Backreferences, lookaround, named captures, observable captures, atomic groups,
conditionals, inline flags, Unicode property escapes, lazy/possessive quantifiers, and
engine-specific escapes are not in v1. Character classes, dot, anchors, and iteration
operate on Unicode scalar values using tables fixed by the conformance version.

Each runtime implements the profile as a small internal compile-and-match module using
a Thompson-style nondeterministic finite automaton or an observably equivalent
linear-time implementation. The limits are 512 Unicode scalar values of source, 4,096
compiled states, and 64 KiB of input. An invalid, unsupported, or over-limit pattern is
preserved in the definition, produces the stable `invalid-pattern` author diagnostic,
and acts as no respondent rule. A respondent is never trapped by an authoring error.

### Async navigation and extensions

C# navigation and validation expose awaitable operations rather than reproducing a
JavaScript `pending` return followed by implicit later navigation. Observable ordering,
validation results, cancellation, answer changes, page changes, and lifecycle events
remain conformance behavior; language-specific task objects do not.

Extension parity is behavioral. C# uses native factories, delegates, records, events,
and task-returning functions; it does not imitate TypeScript class shapes. An external
extension seam becomes stable only after two real adapters or implementations prove it.
Recoverable authored problems return diagnostics. Exceptions are reserved for invalid
SDK use, unsupported contract versions, cancellation, and failures a host must handle.

## Scale, performance, and support targets

The standard workload is 250 questions, 1,000 logic rules, 2,500 materialized answer
leaves, and 50 questions validated on one page. The stress workload is 1,000 questions,
4,000 rules, 10,000 answer leaves, and 200 questions on one page.

On a pinned release-build .NET 10 benchmark runner after warmup, p95 targets are:

| Operation | Standard | Stress |
| --- | ---: | ---: |
| Parse, construct, and initially settle | 100 ms | 500 ms |
| Typical answer-change transaction | 2 ms | 10 ms |
| Synchronous page validation | 5 ms | 25 ms |
| Canonical serialization | 50 ms | 250 ms |
| Retained survey heap | 25 MiB | 100 MiB |
| Total parse allocations | 50 MiB | 250 MiB |

CI protects machine-independent characteristics: parsing is linear in definition size,
expression parsing is linear in source length, dependency planning targets `O(V + E)`,
re-evaluation is proportional to affected nodes and edges, and pattern matching is
`O(states × input)`. Wall-clock benchmarks run on a pinned worker; a regression greater
than 20 percent requires review rather than failing heterogeneous shared runners.

Every release has zero compiler, analyzer, package-validation, trimming, and Native AOT
warnings. Packed-package tests install the `.nupkg` into scratch consumers. CI runs the
latest patched .NET 10 on Windows, Linux, and macOS and adds each later stable runtime.
Preview runtimes are informational. .NET 10 remains supported through its Microsoft
support lifetime; removing a runtime floor is a package major with at least six months'
notice. The latest Kajay major receives regular fixes, and the previous major receives
critical security fixes for 12 months after supersession. Confirmed critical security
fixes target seven days and high-severity fixes target 30 days.

## Consequences

- The C# SDK is native and idiomatic without making TypeScript the hidden specification.
- One package and a small conformance interface concentrate complexity and keep internal
  implementation seams out of the consumer interface.
- V2 requires deliberate TypeScript breaking work before the TypeScript adapter can
  claim it; v1 remains the compatibility record for 1.x.
- The pattern implementation costs more than wrapping each host engine, but buys exact
  cross-runtime behavior, bounded resources, zero runtime dependencies, and no
  catastrophic backtracking.
- Strict coercion, dates, and equality remove surprising existing behavior. Definitions
  relying on those accidents require migration notes for TypeScript 2.0.
- Absolute performance numbers are release targets, not substitutes for structural
  complexity proofs or measurements on representative surveys.

## Alternatives considered

- **Mirror JavaScript behavior in C#.** Rejected because it preserves accidental object,
  date, number, string, and rounding semantics and makes future runtimes harder.
- **Use each platform's regex engine.** Rejected because the dialects and resource
  guarantees differ; `.NET` ECMAScript mode is not JavaScript Unicode mode.
- **Use a native RE2 binding.** Rejected for the first SDK because native/browser/AOT
  distribution would violate the zero-dependency and portability goals.
- **Split model, expressions, validation, and contracts into NuGet packages.** Rejected
  as shallow distribution seams with no independent consumers.
- **Synchronize npm and NuGet versions.** Rejected because implementations can release
  independently; schema and conformance versions are the compatibility claim.

## Parent and related links

- [ADR-0020](./0020-versioned-cross-language-runtime-contract.md)
- [Conformance v1](../../conformance/v1/README.md)
- [Conformance v2](../../conformance/v2/README.md)
- [North Star §6](../NORTH_STAR.md#6-multi-framework-and-multi-runtime-strategy)
- [C# parity ledger](../feature-parity-checklist.md#q--c-headless-sdk)
