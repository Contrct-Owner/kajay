using System.Text.Json;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionDraftResult(
    string ManagedDefinitionName,
    JsonElement Definition,
    string DefinitionDigest,
    long Version,
    string UpdatedBy,
    DateTimeOffset UpdatedAt,
    bool Created);
