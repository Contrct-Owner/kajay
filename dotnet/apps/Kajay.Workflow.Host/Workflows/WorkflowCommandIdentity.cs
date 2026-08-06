using System.Security.Cryptography;
using System.Text;

namespace Kajay.Workflow.Host.Workflows;

internal static class WorkflowCommandIdentity
{
    internal static string Compute(params string[] values)
    {
        string material = string.Join('\n', values);
        return $"sha256:{Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(material)))}";
    }
}
