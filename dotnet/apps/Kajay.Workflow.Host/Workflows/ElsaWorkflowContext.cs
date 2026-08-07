using Elsa.Workflows;

namespace Kajay.Workflow.Host.Workflows;

internal static class ElsaWorkflowContext
{
    private const string TenantKey = "kajay.tenant-id";
    private const string InstanceKey = "kajay.instance-id";

    internal static Dictionary<string, object> CreateProperties(
        string tenantId,
        Guid instanceId)
    {
        return new Dictionary<string, object>(StringComparer.Ordinal)
        {
            [TenantKey] = tenantId,
            [InstanceKey] = instanceId.ToString("N"),
        };
    }

    internal static (string TenantId, Guid InstanceId) Read(ActivityExecutionContext context)
    {
        IDictionary<string, object> properties = context.WorkflowExecutionContext.Properties;
        string tenantId = ReadString(properties, TenantKey);
        Guid instanceId = Guid.ParseExact(ReadString(properties, InstanceKey), "N");
        return (tenantId, instanceId);
    }

    private static string ReadString(IDictionary<string, object> properties, string key)
    {
        return properties.TryGetValue(key, out object? value) && value is string text
            ? text
            : throw new InvalidOperationException($"Elsa workflow property '{key}' is missing.");
    }
}
