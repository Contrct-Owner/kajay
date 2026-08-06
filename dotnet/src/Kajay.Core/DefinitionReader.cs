using System.Text.Json.Nodes;

namespace Kajay;

internal static class DefinitionReader
{
    private static readonly string[] RootProperties =
    [
        "schemaVersion",
        "title",
        "locale",
        "maxTimeToFinish",
        "maxTimeToFinishPage",
        "showTimerPanel",
        "showTimerPanelMode",
        "progressBarType",
        "pages",
    ];
    private static readonly string[] PageProperties =
        ["name", "title", "maxTimeToFinish", "elements"];
    private static readonly string[] ElementProperties =
    [
        "type",
        "name",
        "title",
        "isRequired",
        "inputType",
        "visibleIf",
        "choices",
        "correctAnswer",
        "validators",
    ];
    private static readonly string[] ValidatorProperties = ["type", "text", "regex"];

    internal static JsonObject Read(
        JsonObject input,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        JsonObject unknown = CollectUnknown(
            input,
            RootProperties,
            string.Empty,
            diagnostics);
        var output = new JsonObject { ["schemaVersion"] = 1 };
        CopyLocalizedTextProperty(
            input,
            output,
            "title",
            string.Empty,
            "/title",
            diagnostics);
        CopyStringProperty(input, output, "locale", string.Empty, "/locale", diagnostics);
        CopyProperty(input, output, "maxTimeToFinish");
        CopyProperty(input, output, "maxTimeToFinishPage");
        CopyProperty(input, output, "showTimerPanel");
        CopyProperty(input, output, "showTimerPanelMode", JsonValue.Create("all"));
        CopyProperty(input, output, "progressBarType");
        CopyChildren(input, output, "pages", (child, index) =>
            ReadPage(child, $"/pages/{index}", diagnostics));
        AppendUnknown(output, unknown);
        return output;
    }

    private static JsonObject ReadPage(
        JsonObject input,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        JsonObject unknown = CollectUnknown(input, PageProperties, path, diagnostics);
        var output = new JsonObject();
        CopyProperty(input, output, "name");
        CopyProperty(input, output, "title", JsonValue.Create(string.Empty));
        CopyProperty(input, output, "maxTimeToFinish");
        CopyChildren(input, output, "elements", (child, index) =>
            ReadElement(child, $"{path}/elements/{index}", diagnostics));
        AppendUnknown(output, unknown);
        return output;
    }

    private static JsonObject ReadElement(
        JsonObject input,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        JsonObject unknown = CollectUnknown(input, ElementProperties, path, diagnostics);
        var output = new JsonObject();
        CopyProperty(input, output, "type");
        CopyProperty(input, output, "name");
        CopyLocalizedTextProperty(
            input,
            output,
            "title",
            string.Empty,
            $"{path}/title",
            diagnostics);
        CopyProperty(input, output, "isRequired", JsonValue.Create(false));
        CopyProperty(input, output, "inputType", JsonValue.Create("text"));
        CopyStringProperty(
            input,
            output,
            "visibleIf",
            string.Empty,
            $"{path}/visibleIf",
            diagnostics);
        CopyChoices(input, output);
        CopyProperty(input, output, "correctAnswer");
        CopyChildren(input, output, "validators", (child, index) =>
            ReadValidator(child, $"{path}/validators/{index}", diagnostics));
        AppendUnknown(output, unknown);
        return output;
    }

    private static JsonObject ReadValidator(
        JsonObject input,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        JsonObject unknown = CollectUnknown(input, ValidatorProperties, path, diagnostics);
        var output = new JsonObject();
        CopyProperty(input, output, "type");
        CopyLocalizedTextProperty(input, output, "text", string.Empty, $"{path}/text", diagnostics);
        CopyStringProperty(input, output, "regex", string.Empty, $"{path}/regex", diagnostics);
        if (input["regex"] is JsonValue value
            && value.TryGetValue(out string? pattern)
            && !KajayPatternSyntax.IsValid(pattern))
        {
            diagnostics.Add(new DefinitionDiagnostic(
                "invalid-pattern",
                $"{path}/regex",
                DiagnosticSeverity.Error));
        }

        AppendUnknown(output, unknown);
        return output;
    }

    private static void CopyChoices(JsonObject input, JsonObject output)
    {
        if (input["choices"] is not JsonArray choices)
        {
            return;
        }

        var canonical = new JsonArray();
        foreach (JsonNode? choice in choices)
        {
            canonical.Add(choice is JsonObject choiceObject
                ? choiceObject.DeepClone()
                : new JsonObject { ["value"] = choice?.DeepClone() });
        }

        output["choices"] = canonical;
    }

    private static void CopyProperty(
        JsonObject input,
        JsonObject output,
        string propertyName,
        JsonNode? defaultValue = null)
    {
        if (!input.TryGetPropertyValue(propertyName, out JsonNode? value)
            || JsonNode.DeepEquals(value, defaultValue))
        {
            return;
        }

        output[propertyName] = value?.DeepClone();
    }

    private static void CopyStringProperty(
        JsonObject input,
        JsonObject output,
        string propertyName,
        string defaultValue,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (!input.TryGetPropertyValue(propertyName, out JsonNode? value))
        {
            return;
        }

        if (value is JsonValue jsonValue
            && jsonValue.TryGetValue(out string? text))
        {
            if (!string.Equals(text, defaultValue, StringComparison.Ordinal))
            {
                output[propertyName] = text;
            }

            return;
        }

        diagnostics.Add(new DefinitionDiagnostic(
            "property-type-mismatch",
            path,
            DiagnosticSeverity.Error));
    }

    private static void CopyLocalizedTextProperty(
        JsonObject input,
        JsonObject output,
        string propertyName,
        string defaultValue,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        if (input[propertyName] is JsonObject localized)
        {
            output[propertyName] = localized.DeepClone();
            return;
        }

        CopyStringProperty(
            input,
            output,
            propertyName,
            defaultValue,
            path,
            diagnostics);
    }

    private static void CopyChildren(
        JsonObject input,
        JsonObject output,
        string propertyName,
        Func<JsonObject, int, JsonObject> readChild)
    {
        if (input[propertyName] is not JsonArray children)
        {
            return;
        }

        var canonical = new JsonArray();
        for (int index = 0; index < children.Count; index += 1)
        {
            JsonNode? child = children[index];
            canonical.Add(child is JsonObject childObject
                ? readChild(childObject, index)
                : child?.DeepClone());
        }

        output[propertyName] = canonical;
    }

    private static JsonObject CollectUnknown(
        JsonObject input,
        IReadOnlyCollection<string> knownProperties,
        string path,
        ICollection<DefinitionDiagnostic> diagnostics)
    {
        var unknown = new JsonObject();
        foreach ((string propertyName, JsonNode? value) in input)
        {
            if (knownProperties.Contains(propertyName, StringComparer.Ordinal))
            {
                continue;
            }

            unknown[propertyName] = value?.DeepClone();
            diagnostics.Add(new DefinitionDiagnostic(
                "unknown-property",
                $"{path}/{EscapePointerSegment(propertyName)}",
                DiagnosticSeverity.Warning));
        }

        return unknown;
    }

    private static void AppendUnknown(JsonObject output, JsonObject unknown)
    {
        foreach ((string propertyName, JsonNode? value) in unknown)
        {
            output[propertyName] = value?.DeepClone();
        }
    }

    private static string EscapePointerSegment(string value)
    {
        return value.Replace("~", "~0", StringComparison.Ordinal)
            .Replace("/", "~1", StringComparison.Ordinal);
    }
}
