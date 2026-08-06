using System.Text.Json.Nodes;

namespace Kajay.Demo.Api;

public sealed record DemoSnapshotResult(
    string Runtime,
    string DefinitionDigest,
    JsonNode Snapshot,
    IReadOnlyDictionary<string, object?> RestoredData);
