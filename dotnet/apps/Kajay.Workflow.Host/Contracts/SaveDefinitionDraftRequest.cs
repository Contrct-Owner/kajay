using System.Text.Json;

namespace Kajay.Workflow.Host.Contracts;

internal sealed record SaveDefinitionDraftRequest(JsonElement Definition);
