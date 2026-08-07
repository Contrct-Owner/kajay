using System.Text.Json;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record DefinitionRevisionResult(
    string ManagedDefinitionName,
    long Number,
    long SourceDraftVersion,
    JsonElement Definition,
    string DefinitionDigest,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    bool Created);
