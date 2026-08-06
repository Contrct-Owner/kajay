using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeCondition(
    string Key,
    string Name,
    SurveyElementKind ElementKind,
    string? ParentKey,
    int PageIndex,
    bool AuthoredRequired,
    bool HasRequiredCondition,
    SurveyExpression? VisibleIf,
    SurveyExpression? EnableIf,
    SurveyExpression? RequiredIf)
{
    internal static SurveyRuntimeCondition Page(JsonNode? page, int pageIndex)
    {
        string key = $"page:{pageIndex:D8}";
        return new SurveyRuntimeCondition(
            key,
            page?["name"]?.GetValue<string>() ?? string.Empty,
            SurveyElementKind.Page,
            null,
            pageIndex,
            false,
            false,
            Parse(page?["visibleIf"]),
            null,
            null);
    }

    internal static SurveyRuntimeCondition[] FromElements(
        JsonArray elements,
        int pageIndex,
        SurveyDefinitionRegistry registry)
    {
        HashSet<string> questionTypes = registry.Metadata
            .GetConcreteSubclasses("question")
            .ToHashSet(StringComparer.Ordinal);
        List<SurveyRuntimeCondition> conditions = [];
        Collect(elements, pageIndex, null, "element", questionTypes, registry, conditions);
        return conditions.ToArray();
    }

    private static void Collect(
        JsonArray elements,
        int pageIndex,
        string? parentKey,
        string path,
        IReadOnlySet<string> questionTypes,
        SurveyDefinitionRegistry registry,
        ICollection<SurveyRuntimeCondition> conditions)
    {
        int index = 0;
        foreach (JsonObject element in elements.OfType<JsonObject>())
        {
            string key = $"page:{pageIndex:D8}:{path}:{index:D8}";
            string type = element["type"]?.GetValue<string>() ?? string.Empty;
            SurveyElementKind kind = questionTypes.Contains(type)
                ? SurveyElementKind.Question
                : registry.Metadata.IsSubclassOf(type, "panel")
                    ? SurveyElementKind.Panel
                    : SurveyElementKind.Element;
            conditions.Add(new SurveyRuntimeCondition(
                key,
                element["name"]?.GetValue<string>() ?? string.Empty,
                kind,
                parentKey,
                pageIndex,
                element["isRequired"]?.GetValue<bool>() ?? false,
                HasExpression(element["requiredIf"]),
                Parse(element["visibleIf"]),
                Parse(element["enableIf"]),
                kind == SurveyElementKind.Question ? Parse(element["requiredIf"]) : null));
            IEnumerable<DefinitionChildCollectionDescriptor> nestedCollections =
                kind == SurveyElementKind.Question
                    ? []
                    : registry.Metadata.GetChildCollections(type)
                        .Where(collection => registry.Metadata.IsSubclassOf(
                            collection.ElementBaseType,
                            "pageelement"));
            foreach (DefinitionChildCollectionDescriptor collection in nestedCollections)
            {
                if (element[collection.Property] is JsonArray children)
                {
                    Collect(
                        children,
                        pageIndex,
                        key,
                        $"{path}:{index:D8}:{collection.Property}",
                        questionTypes,
                        registry,
                        conditions);
                }
            }

            index += 1;
        }
    }

    private static SurveyExpression? Parse(JsonNode? source)
    {
        string text = source?.GetValue<string>() ?? string.Empty;
        return text.Length == 0 ? null : SurveyExpression.Parse(text).Expression;
    }

    private static bool HasExpression(JsonNode? source)
    {
        return (source?.GetValue<string>() ?? string.Empty).Length > 0;
    }
}
