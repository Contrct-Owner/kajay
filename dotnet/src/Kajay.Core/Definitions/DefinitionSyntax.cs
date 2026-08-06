using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kajay.Definitions;

internal static class DefinitionSyntax
{
    internal static void ValidateSchemaVersion(JsonObject input, string propertyName)
    {
        if (!input.TryGetPropertyValue(propertyName, out JsonNode? value))
        {
            return;
        }
        if (value is not JsonValue jsonValue
            || !jsonValue.TryGetValue(out int declaredVersion))
        {
            throw new JsonException($"'{propertyName}' must be an integer when present.");
        }
        if (!KajayContracts.SupportedSurveySchemaVersions.Contains(declaredVersion))
        {
            throw new UnsupportedSurveySchemaVersionException(declaredVersion);
        }
    }

    internal static string EscapePointerSegment(string value)
    {
        return value.Replace("~", "~0", StringComparison.Ordinal)
            .Replace("/", "~1", StringComparison.Ordinal);
    }
}
