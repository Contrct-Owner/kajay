using System.Text.Json.Nodes;

namespace Kajay.Runtime;

internal sealed record SurveyRuntimeQuestion(
    string Type,
    string Name,
    string ValueKey,
    JsonObject Properties,
    SurveyLocalizedText Title,
    SurveyLocalizedText Description,
    IReadOnlyList<KajayValue> Choices,
    IReadOnlyList<SurveyRuntimeChoiceItem> ChoiceItems,
    SurveyRuntimeChoiceSettings? ChoiceSettings,
    IReadOnlyList<KajayValue> Rows,
    SurveyRuntimeMatrixSettings? MatrixSettings,
    SurveyRuntimeRecordSettings? RecordSettings,
    SurveyRuntimeBlankSettings? BlankSettings,
    SurveyRuntimeFileSettings? FileSettings,
    SurveyRuntimeSignatureSettings? SignatureSettings,
    bool AuthoredRequired,
    SurveyExpression? VisibleIf,
    SurveyExpression? RequiredIf,
    SurveyLocalizedText RequiredMessage,
    bool HasCorrectAnswer,
    KajayValue CorrectAnswer,
    IReadOnlyList<SurveyRuntimeValidator> Validators)
{
    internal static SurveyRuntimeQuestion[] FromElements(
        JsonArray elements,
        SurveyDefinitionRegistry registry)
    {
        HashSet<string> questionTypes = registry.Metadata
            .GetConcreteSubclasses("question")
            .ToHashSet(StringComparer.Ordinal);
        List<SurveyRuntimeQuestion> questions = [];
        Collect(elements, questionTypes, registry, questions);
        return questions.ToArray();
    }

    public static SurveyRuntimeQuestion From(
        JsonObject element,
        SurveyDefinitionRegistry registry)
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
        IReadOnlyList<SurveyRuntimeChoiceItem> choiceItems = ReadChoiceItems(
            element["choices"] as JsonArray);
        return new SurveyRuntimeQuestion(
            element["type"]?.GetValue<string>() ?? string.Empty,
            element["name"]?.GetValue<string>() ?? string.Empty,
            ReadValueKey(element),
            (JsonObject)element.DeepClone(),
            SurveyLocalizedText.From(element["title"]),
            SurveyLocalizedText.From(element["description"]),
            Array.AsReadOnly(choiceItems.Select(item => item.Value).ToArray()),
            choiceItems,
            ReadChoiceSettings(element),
            ReadItems(element["rows"] as JsonArray),
            ReadMatrixSettings(element, registry),
            ReadRecordSettings(element, registry),
            SurveyRuntimeBlankSettings.From(element),
            ReadFileSettings(element),
            ReadSignatureSettings(element),
            element["isRequired"]?.GetValue<bool>() ?? false,
            ReadExpression(element["visibleIf"]),
            ReadExpression(element["requiredIf"]),
            SurveyLocalizedText.From(element["requiredErrorText"]),
            hasCorrectAnswer,
            hasCorrectAnswer ? KajayJsonValue.From(correctAnswer) : KajayValue.Absent,
            runtimeValidators);
    }

    private static IReadOnlyList<SurveyRuntimeChoiceItem> ReadChoiceItems(JsonArray? items)
    {
        if (items is null)
        {
            return Array.Empty<SurveyRuntimeChoiceItem>();
        }

        return Array.AsReadOnly(items.Select(item =>
        {
            JsonNode? source = item;
            JsonNode? text = null;
            if (item is JsonObject descriptor
                && descriptor.TryGetPropertyValue("value", out JsonNode? value))
            {
                source = value;
                _ = descriptor.TryGetPropertyValue("text", out text);
            }

            KajayValue choice = KajayJsonValue.From(source);
            return new SurveyRuntimeChoiceItem(choice, ReadChoiceText(text, choice));
        }).ToArray());
    }

    private static SurveyLocalizedText ReadChoiceText(JsonNode? text, KajayValue value)
    {
        if (text is JsonValue jsonText && jsonText.TryGetValue(out string? content))
        {
            return SurveyLocalizedText.From(JsonValue.Create(content));
        }

        if (text is JsonObject)
        {
            return SurveyLocalizedText.From(text);
        }

        string fallback = KajayText.TryConvert(value, out string converted)
            ? converted
            : string.Empty;
        return SurveyLocalizedText.From(JsonValue.Create(fallback));
    }

    private static SurveyRuntimeChoiceSettings? ReadChoiceSettings(JsonObject element)
    {
        string type = element["type"]?.GetValue<string>() ?? string.Empty;
        if (type is not ("checkbox" or "dropdown" or "imagepicker" or "radiogroup"
            or "ranking" or "tagbox"))
        {
            return null;
        }

        return new SurveyRuntimeChoiceSettings(
            ReadString(element["choicesFromQuestion"]),
            ReadString(element["choicesFromQuestionMode"]),
            ReadString(element["choicesByUrl"]),
            ReadString(element["choicesPath"]),
            ReadString(element["choicesValueName"]),
            ReadString(element["choicesTitleName"]),
            element["choicesLazyLoadEnabled"]?.GetValue<bool>() ?? false,
            ReadCount(element["choicesLazyLoadPageSize"], 25));
    }

    private static string ReadString(JsonNode? node)
    {
        return node?.GetValue<string>() ?? string.Empty;
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

    private static SurveyRuntimeRecordSettings? ReadRecordSettings(
        JsonObject element,
        SurveyDefinitionRegistry registry)
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
                element["defaultValueFromLastRow"]?.GetValue<bool>() ?? false,
                ReadFields(element["columns"] as JsonArray, registry)),
            "paneldynamic" => new SurveyRuntimeRecordSettings(
                ReadCount(element["minPanelCount"], 1),
                ReadCount(element["maxPanelCount"], 0),
                element["allowAddPanel"]?.GetValue<bool>() ?? true,
                element["allowRemovePanel"]?.GetValue<bool>() ?? true,
                ReadRecord(element["defaultPanelValue"]),
                false,
                ReadFields(element["templateElements"] as JsonArray, registry)),
            _ => null,
        };
    }

    private static SurveyRuntimeMatrixSettings? ReadMatrixSettings(
        JsonObject element,
        SurveyDefinitionRegistry registry)
    {
        string type = element["type"]?.GetValue<string>() ?? string.Empty;
        return type is "matrix" or "matrixcells"
            ? new SurveyRuntimeMatrixSettings(
                element["isAllRowRequired"]?.GetValue<bool>() ?? false,
                element["eachRowUnique"]?.GetValue<bool>() ?? false,
                type == "matrixcells"
                    ? ReadFields(element["columns"] as JsonArray, registry)
                    : Array.Empty<SurveyRuntimeQuestion>())
            : null;
    }

    private static IReadOnlyList<SurveyRuntimeQuestion> ReadFields(
        JsonArray? fields,
        SurveyDefinitionRegistry registry)
    {
        return fields is null
            ? Array.Empty<SurveyRuntimeQuestion>()
            : Array.AsReadOnly(FromElements(fields, registry));
    }

    private static SurveyExpression? ReadExpression(JsonNode? node)
    {
        string source = node?.GetValue<string>() ?? string.Empty;
        return source.Length == 0 ? null : SurveyExpression.Parse(source).Expression;
    }

    private static int ReadCount(JsonNode? node, int defaultValue)
    {
        return node is null ? defaultValue : Math.Max(0, (int)node.GetValue<double>());
    }

    private static SurveyRuntimeFileSettings? ReadFileSettings(JsonObject element)
    {
        return element["type"]?.GetValue<string>() == "file"
            ? new SurveyRuntimeFileSettings(
                element["allowMultiple"]?.GetValue<bool>() ?? false,
                element["acceptedTypes"]?.GetValue<string>() ?? string.Empty,
                Math.Max(0, (long)(element["maxSize"]?.GetValue<double>() ?? 0)),
                ReadCount(element["maxFileCount"], 0),
                element["storeDataAsText"]?.GetValue<bool>() ?? false)
            : null;
    }

    private static SurveyRuntimeSignatureSettings? ReadSignatureSettings(JsonObject element)
    {
        if (element["type"]?.GetValue<string>() != "signaturepad")
        {
            return null;
        }

        SurveySignatureFormat format = element["signatureFormat"]?.GetValue<string>() switch
        {
            "jpeg" => SurveySignatureFormat.Jpeg,
            "svg" => SurveySignatureFormat.Svg,
            _ => SurveySignatureFormat.Png,
        };
        return new SurveyRuntimeSignatureSettings(
            element["penColor"]?.GetValue<string>() ?? "#1d2939",
            element["backgroundColor"]?.GetValue<string>() ?? string.Empty,
            format,
            ReadCount(element["signatureWidth"], 400),
            ReadCount(element["signatureHeight"], 160));
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
        SurveyDefinitionRegistry registry,
        ICollection<SurveyRuntimeQuestion> questions)
    {
        foreach (JsonObject element in elements.OfType<JsonObject>())
        {
            string type = element["type"]?.GetValue<string>() ?? string.Empty;
            if (questionTypes.Contains(type))
            {
                questions.Add(From(element, registry));
                continue;
            }

            foreach (DefinitionChildCollectionDescriptor collection in registry.Metadata
                         .GetChildCollections(type)
                         .Where(collection => registry.Metadata.IsSubclassOf(
                             collection.ElementBaseType,
                             "pageelement")))
            {
                if (element[collection.Property] is JsonArray children)
                {
                    Collect(children, questionTypes, registry, questions);
                }
            }
        }
    }
}
