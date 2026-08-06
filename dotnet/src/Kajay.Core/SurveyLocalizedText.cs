using System.Text.Json.Nodes;

namespace Kajay;

internal sealed class SurveyLocalizedText
{
    private readonly string? _plainText;
    private readonly IReadOnlyList<KeyValuePair<string, string>> _translations;

    private SurveyLocalizedText(
        string? plainText,
        IReadOnlyList<KeyValuePair<string, string>> translations)
    {
        _plainText = plainText;
        _translations = translations;
    }

    internal static SurveyLocalizedText Empty { get; } = new(
        string.Empty,
        Array.Empty<KeyValuePair<string, string>>());

    internal static SurveyLocalizedText From(JsonNode? node)
    {
        if (node is JsonValue value && value.TryGetValue(out string? text))
        {
            return new SurveyLocalizedText(text, Array.Empty<KeyValuePair<string, string>>());
        }

        if (node is not JsonObject localized)
        {
            return Empty;
        }

        KeyValuePair<string, string>[] translations = localized
            .Select(entry => new KeyValuePair<string, string>(
                entry.Key,
                entry.Value?.GetValue<string>() ?? string.Empty))
            .ToArray();
        return new SurveyLocalizedText(null, Array.AsReadOnly(translations));
    }

    internal string Resolve(string locale)
    {
        if (_plainText is not null)
        {
            return _plainText;
        }

        if (TryFind(locale, out string exact))
        {
            return exact;
        }

        int separator = locale.LastIndexOf('-');
        if (separator > 0 && TryFind(locale[..separator], out string parent))
        {
            return parent;
        }

        return TryFind("default", out string fallback) ? fallback : string.Empty;
    }

    private bool TryFind(string locale, out string value)
    {
        foreach ((string candidate, string text) in _translations)
        {
            if (LocaleEquals(candidate, locale))
            {
                value = text;
                return true;
            }
        }

        value = string.Empty;
        return false;
    }

    internal static bool LocaleEquals(string left, string right)
    {
        if (left.Length != right.Length)
        {
            return false;
        }

        for (int index = 0; index < left.Length; index += 1)
        {
            char leftCharacter = FoldAscii(left[index]);
            char rightCharacter = FoldAscii(right[index]);
            if (leftCharacter != rightCharacter)
            {
                return false;
            }
        }

        return true;
    }

    private static char FoldAscii(char value)
    {
        return value is >= 'A' and <= 'Z' ? (char)(value + ('a' - 'A')) : value;
    }
}
