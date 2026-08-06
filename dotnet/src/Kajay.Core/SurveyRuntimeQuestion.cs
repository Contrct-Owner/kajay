using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeQuestion(
    string Type,
    string Name,
    string ValueKey,
    IReadOnlyList<KajayValue> Choices,
    IReadOnlyList<KajayValue> Rows,
    SurveyRuntimeRecordSettings? RecordSettings,
    string RequiredMessage,
    bool HasCorrectAnswer,
    KajayValue CorrectAnswer,
    IReadOnlyList<SurveyRuntimeValidator> Validators)
{
    internal static SurveyRuntimeQuestion[] FromElements(JsonArray elements)
    {
        HashSet<string> questionTypes = DefinitionRegistry.Default
            .GetConcreteSubclasses("question")
            .ToHashSet(StringComparer.Ordinal);
        List<SurveyRuntimeQuestion> questions = [];
        Collect(elements, questionTypes, questions);
        return questions.ToArray();
    }

    public static SurveyRuntimeQuestion From(JsonObject element)
    {
        JsonArray? validators = element["validators"] as JsonArray;
        SurveyRuntimeValidator[] runtimeValidators = validators is null
            ? []
            : validators
                .OfType<JsonObject>()
                .Select(SurveyRuntimeValidator.From)
                .ToArray();
        bool hasCorrectAnswer = element.TryGetPropertyValue(
            "correctAnswer",
            out JsonNode? correctAnswer);
        return new SurveyRuntimeQuestion(
            element["type"]?.GetValue<string>() ?? string.Empty,
            element["name"]?.GetValue<string>() ?? string.Empty,
            ReadValueKey(element),
            ReadItems(element["choices"] as JsonArray),
            ReadItems(element["rows"] as JsonArray),
            ReadRecordSettings(element),
            element["requiredErrorText"]?.GetValue<string>() ?? string.Empty,
            hasCorrectAnswer,
            hasCorrectAnswer ? KajayJsonValue.From(correctAnswer) : KajayValue.Absent,
            runtimeValidators);
    }

    private static IReadOnlyList<KajayValue> ReadItems(JsonArray? items)
    {
        if (items is null)
        {
            return Array.Empty<KajayValue>();
        }

        return Array.AsReadOnly(items.Select(item =>
        {
            return item is JsonObject descriptor
                && descriptor.TryGetPropertyValue("value", out JsonNode? value)
                ? KajayJsonValue.From(value)
                : KajayJsonValue.From(item);
        }).ToArray());
    }

    private static SurveyRuntimeRecordSettings? ReadRecordSettings(JsonObject element)
    {
        string type = element["type"]?.GetValue<string>() ?? string.Empty;
        return type switch
        {
            "matrixdynamic" => new SurveyRuntimeRecordSettings(
                ReadCount(element["minRowCount"], 1),
                ReadCount(element["maxRowCount"], 0),
                element["allowAddRows"]?.GetValue<bool>() ?? true,
                element["allowRemoveRows"]?.GetValue<bool>() ?? true,
                ReadRecord(element["defaultRowValue"]),
                element["defaultValueFromLastRow"]?.GetValue<bool>() ?? false),
            "paneldynamic" => new SurveyRuntimeRecordSettings(
                ReadCount(element["minPanelCount"], 1),
                ReadCount(element["maxPanelCount"], 0),
                element["allowAddPanel"]?.GetValue<bool>() ?? true,
                element["allowRemovePanel"]?.GetValue<bool>() ?? true,
                ReadRecord(element["defaultPanelValue"]),
                false),
            _ => null,
        };
    }

    private static int ReadCount(JsonNode? node, int defaultValue)
    {
        return node is null ? defaultValue : Math.Max(0, (int)node.GetValue<double>());
    }

    private static KajayValue ReadRecord(JsonNode? node)
    {
        return node is JsonObject ? KajayJsonValue.From(node) : KajayValue.FromObject([]);
    }

    private static string ReadValueKey(JsonObject element)
    {
        string name = element["name"]?.GetValue<string>() ?? string.Empty;
        string valueName = element["valueName"]?.GetValue<string>() ?? string.Empty;
        return valueName.Length > 0 ? valueName : name;
    }

    private static void Collect(
        JsonArray elements,
        IReadOnlySet<string> questionTypes,
        ICollection<SurveyRuntimeQuestion> questions)
    {
        foreach (JsonObject element in elements.OfType<JsonObject>())
        {
            string type = element["type"]?.GetValue<string>() ?? string.Empty;
            if (questionTypes.Contains(type))
            {
                questions.Add(From(element));
            }

            if (element["elements"] is JsonArray children)
            {
                Collect(children, questionTypes, questions);
            }
        }
    }
}
