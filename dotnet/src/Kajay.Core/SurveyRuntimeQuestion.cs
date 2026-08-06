using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeQuestion(
    string Type,
    string Name,
    string ValueKey,
    IReadOnlyList<KajayValue> Choices,
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
            ReadChoices(element["choices"] as JsonArray),
            element["requiredErrorText"]?.GetValue<string>() ?? string.Empty,
            hasCorrectAnswer,
            hasCorrectAnswer ? KajayJsonValue.From(correctAnswer) : KajayValue.Absent,
            runtimeValidators);
    }

    private static IReadOnlyList<KajayValue> ReadChoices(JsonArray? choices)
    {
        if (choices is null)
        {
            return Array.Empty<KajayValue>();
        }

        return Array.AsReadOnly(choices.Select(choice =>
        {
            return choice is JsonObject item && item.TryGetPropertyValue("value", out JsonNode? value)
                ? KajayJsonValue.From(value)
                : KajayJsonValue.From(choice);
        }).ToArray());
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
