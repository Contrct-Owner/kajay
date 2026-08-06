namespace Kajay.Hosting;

internal static class SurveyChoiceResponseMapper
{
    public static IReadOnlyList<SurveyChoiceItem> Map(
        KajayValue payload,
        SurveyChoiceCacheKey key,
        string questionName)
    {
        KajayValue rows = ReadPath(payload, key.Path);
        if (rows.Kind != KajayValueKind.Array)
        {
            throw Failure(
                questionName,
                key.Url,
                $"The choice resource did not contain an array at path '{key.Path}'.");
        }

        return Array.AsReadOnly(rows.GetArray()
            .Select(row => MapItem(row, key, questionName))
            .ToArray());
    }

    private static SurveyChoiceItem MapItem(
        KajayValue row,
        SurveyChoiceCacheKey key,
        string questionName)
    {
        if (row.Kind != KajayValueKind.Map)
        {
            KajayValue scalar = NormalizeScalar(row, key, questionName);
            return new SurveyChoiceItem(scalar, ToText(scalar));
        }

        if (key.ValueName.Length == 0)
        {
            throw Failure(
                questionName,
                key.Url,
                "Object choice rows require a choicesValueName property.");
        }

        IReadOnlyDictionary<string, KajayValue> fields = row.GetObject();
        if (!fields.TryGetValue(key.ValueName, out KajayValue source))
        {
            throw Failure(
                questionName,
                key.Url,
                $"A choice row did not contain the value field '{key.ValueName}'.");
        }

        KajayValue value = NormalizeScalar(source, key, questionName);
        KajayValue title = key.TitleName.Length > 0
            && fields.TryGetValue(key.TitleName, out KajayValue configuredTitle)
                ? configuredTitle
                : value;
        return new SurveyChoiceItem(value, ToText(title));
    }

    private static KajayValue ReadPath(KajayValue payload, string path)
    {
        KajayValue current = payload;
        if (path.Trim().Length == 0)
        {
            return current;
        }

        foreach (string segment in path.Split('.'))
        {
            if (current.Kind != KajayValueKind.Map
                || !current.GetObject().TryGetValue(segment, out current))
            {
                return KajayValue.Absent;
            }
        }

        return current;
    }

    private static KajayValue NormalizeScalar(
        KajayValue value,
        SurveyChoiceCacheKey key,
        string questionName)
    {
        if (value.Kind is KajayValueKind.Null or KajayValueKind.Absent)
        {
            return KajayValue.From(string.Empty);
        }
        if (value.Kind is KajayValueKind.Array or KajayValueKind.Map)
        {
            throw Failure(
                questionName,
                key.Url,
                "Choice values must be scalar Kajay values.");
        }

        return value;
    }

    private static string ToText(KajayValue value)
    {
        return KajayText.TryConvert(value, out string text) ? text : string.Empty;
    }

    private static SurveyChoiceLoadException Failure(
        string questionName,
        string url,
        string message)
    {
        return new SurveyChoiceLoadException(questionName, url, message);
    }
}
