namespace Kajay;

/// <summary>A DOM-free file descriptor stored in a survey response.</summary>
/// <param name="Name">The respondent-visible file name.</param>
/// <param name="MediaType">The MIME media type, or an empty string when unknown.</param>
/// <param name="Size">The non-negative size in bytes.</param>
/// <param name="Content">Optional data URL or other inline content.</param>
/// <param name="Url">Optional durable or host-minted URL.</param>
public sealed record SurveyFileEntry(
    string Name,
    string MediaType,
    long Size,
    string? Content = null,
    string? Url = null)
{
    internal static bool TryFrom(KajayValue value, out SurveyFileEntry? entry)
    {
        entry = null;
        if (value.Kind != KajayValueKind.Map)
        {
            return false;
        }

        IReadOnlyDictionary<string, KajayValue> map = value.GetObject();
        if (!map.TryGetValue("name", out KajayValue nameValue)
            || !KajayText.TryConvert(nameValue, out string name)
            || name.Length == 0)
        {
            return false;
        }

        string mediaType = ReadText(map, "type");
        long size = map.TryGetValue("size", out KajayValue sizeValue)
            && KajayNumber.TryConvert(sizeValue, out double number)
                ? Math.Max(0, (long)number)
                : 0;
        entry = new SurveyFileEntry(
            name,
            mediaType,
            size,
            ReadOptionalText(map, "content"),
            ReadOptionalText(map, "url"));
        return true;
    }

    internal KajayValue ToValue(bool includeContent)
    {
        var fields = new List<KeyValuePair<string, KajayValue>>
        {
            new("name", KajayValue.From(Name)),
            new("type", KajayValue.From(MediaType)),
            new("size", KajayValue.From(Size)),
        };
        if (includeContent && Content is not null)
        {
            fields.Add(new("content", KajayValue.From(Content)));
        }
        if (Url is not null)
        {
            fields.Add(new("url", KajayValue.From(Url)));
        }

        return KajayValue.FromObject(fields);
    }

    private static string ReadText(IReadOnlyDictionary<string, KajayValue> map, string name)
    {
        return map.TryGetValue(name, out KajayValue value)
            && KajayText.TryConvert(value, out string text)
                ? text
                : string.Empty;
    }

    private static string? ReadOptionalText(
        IReadOnlyDictionary<string, KajayValue> map,
        string name)
    {
        string text = ReadText(map, name);
        return text.Length == 0 ? null : text;
    }
}
