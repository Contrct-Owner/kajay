using System.Security.Cryptography;
using System.Text;

namespace Kajay.Definitions;

internal static class DefinitionDigest
{
    internal static string Compute(string canonicalJson)
    {
        byte[] digest = SHA256.HashData(Encoding.UTF8.GetBytes(canonicalJson));
        return $"sha256:{Convert.ToHexStringLower(digest)}";
    }
}
