# Kajay SDK Summary

- Area: Published SDKs and shared compatibility contracts
- Status: active
- Owner: Jarod
- Last updated: 2026-08-12

Kajay ships two maintained runtime implementations over one authoritative survey
definition and versioned behavior contract.

## Topic index

- **[TypeScript runtime](../packages/core/README.md)**
  - Status: published on the 1.x train; workspace version 1.2.0
  - Owner: Jarod
  - Includes the headless runtime, expression engine, metadata, serialization, and
    host-extension seams.
- **[React renderer](../packages/react/README.md)**
  - Status: published on the 1.x train
  - Owner: Jarod
  - Renders `@kajay/core` models and exposes renderer and design-system seams.
- **[TypeScript Creator](../packages/creator-react/README.md)**
  - Status: published on the 1.x train
  - Owner: Jarod
  - Combines the headless Creator model with a default React assembly and composable
    panels.
- **[C# runtime](../dotnet/README.md)**
  - Status: `Kajay.Core` 1.0.0 published for .NET 10+
  - Owner: Jarod
  - Implements the native headless runtime, hosting delegates, snapshots, and
    extension registry.
- **[Definition contracts](../contracts/)**
  - Status: active and generated
  - Owner: Jarod
  - Defines the shared schema, metadata, and stable diagnostics.
- **[Cross-runtime conformance](../conformance/v2/README.md)**
  - Status: v1 maintained; v2 passes in C# and the TypeScript 2.x candidate
  - Owner: Jarod
  - Defines observable behavior independently of language APIs.

## Compatibility at a glance

| Surface | TypeScript 1.x | C# 1.x |
| --- | --- | --- |
| Survey schema | v1 | v1 |
| Runtime conformance | v1 published; v2 candidate passes | v1 and v2 |
| Response Snapshot | v1 | v1 |
| UI renderer | React | Host-provided |
| Creator | Headless + React | Not provided |

Package versions are independent across npm and NuGet. Interoperability is established
by the schema, conformance, and snapshot versions rather than matching package numbers.

## Related areas

- [Project context](../CONTEXT.md)
- [Documentation system](./documentation-system-details.md)
- [Public TypeScript interface ledger](./public-package-interfaces.md)
- [C# parity ledger](./feature-parity-checklist.md#q--c-headless-sdk)

## Change log

- 2026-08-12: Added one current entry point for both published SDK families.
