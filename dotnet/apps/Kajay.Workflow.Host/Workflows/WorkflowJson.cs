using System.Text.Json;

namespace Kajay.Workflow.Host.Workflows;

internal static class WorkflowJson
{
    internal static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web);
}
