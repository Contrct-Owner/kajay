using System.Security.Cryptography;
using System.Text;

namespace Kajay.Workflow.Host.Definitions;

internal static class DefinitionReleaseDigest
{
    internal static string Compute(DefinitionReleaseContent content)
    {
        var material = new StringBuilder()
            .Append("kajay-definition-release-v1\n")
            .Append(content.ManagedDefinitionName).Append('\n')
            .Append(content.VersionLabel).Append('\n')
            .Append(content.ConformanceVersion).Append('\n')
            .Append(content.Workflow.ToCanonicalJson()).Append('\n');
        foreach ((string digest, string definition) in content.SurveyDefinitions
            .OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            _ = material.Append(digest).Append('\n').Append(definition).Append('\n');
        }
        foreach (string binding in content.RequiredBindings.Order(StringComparer.Ordinal))
        {
            _ = material.Append(binding).Append('\n');
        }
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(material.ToString()));
        return $"sha256:{Convert.ToHexStringLower(hash)}";
    }
}
