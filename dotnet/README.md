# Kajay.Core

`Kajay.Core` is the native .NET implementation of Kajay's embedded headless survey
runtime. It targets .NET 10 and is being built against the same authoritative JSON
definition and versioned conformance contract as `@kajay/core`.

The package is under active development and is not yet a compatible runtime. Its first
stable release requires every C# parity row and the shared conformance corpus to pass.

The first public definition tracer is available:

```csharp
SurveyDefinitionParseResult result = SurveyDefinition.Parse(json);
string canonicalJson = result.Definition.ToCanonicalJson();
foreach (DefinitionDiagnostic diagnostic in result.Diagnostics)
{
    Console.WriteLine($"{diagnostic.Severity}: {diagnostic.Code} at {diagnostic.Path}");
}
```

See [ADR-0030](../docs/adr/0030-native-csharp-sdk-and-v2-runtime-semantics.md) for the
package, semantic, performance, and support contract.
