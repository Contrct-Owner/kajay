namespace Kajay.Expressions;

/// <summary>
/// The <c>{$name}</c> scope: values the host supplies, addressed apart from the answers.
/// </summary>
/// <remarks>
/// A scope that is explicitly not the answer space. A host knows things the definition does
/// not and the respondent must not be asked — a tier, a balance, an entitlement — and writing
/// that context as an answer would put it in the response, in the snapshot, and within the
/// respondent's reach. Unlike deployment endpoints, which are constant for a session and are
/// kept out of the dependency graph, a host value changes during one.
/// </remarks>
internal static class HostValueScope
{
    /// <summary>The sigil that tells the two scopes apart. Collision is impossible by construction.</summary>
    private const char Sigil = '$';

    /// <summary>Reports whether a reference names a host value rather than an answer.</summary>
    /// <param name="name">The first segment of a written reference.</param>
    /// <returns>True when the name carries the host-value sigil.</returns>
    internal static bool IsHostValueName(string name)
    {
        return name.Length > 0 && name[0] == Sigil;
    }

    /// <summary>Gets the key a reference names, without its sigil.</summary>
    /// <param name="name">A reference known to carry the sigil.</param>
    /// <returns>The host-value key.</returns>
    internal static string ToKey(string name)
    {
        return name[1..];
    }

    /// <summary>Gets the reference an author writes for a key the host supplies.</summary>
    /// <param name="key">The host-value key.</param>
    /// <returns>The sigil-prefixed reference every rule declares its dependency under.</returns>
    internal static string ToReference(string key)
    {
        return string.Concat(Sigil.ToString(), key);
    }
}
