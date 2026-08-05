using System.Text.Json.Nodes;

namespace Kajay;

internal static class DefinitionReader
{
    private static readonly string[] RootProperties = ["schemaVersion", "title", "pages"];
    private static readonly string[] PageProperties = ["name", "title", "elements"];
    private static readonly string[] ElementProperties = ["type", "name", "isRequired", "inputType"];

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
        CopyProperty(input, output, "title", JsonValue.Create(string.Empty));
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
        CopyProperty(input, output, "isRequired", JsonValue.Create(false));
        CopyProperty(input, output, "inputType", JsonValue.Create("text"));
        AppendUnknown(output, unknown);
        return output;
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
