using System.Text.Json.Nodes;

namespace Kajay.Runtime;

internal sealed record SurveyRuntimeCalculatedValue(
    string Name,
    SurveyExpression? Expression,
    bool IncludeIntoResult)
{
    internal static SurveyRuntimeCalculatedValue From(JsonObject definition)
    {
        string source = definition["expression"]?.GetValue<string>() ?? string.Empty;
        return new SurveyRuntimeCalculatedValue(
            definition["name"]?.GetValue<string>() ?? string.Empty,
            SurveyExpression.Parse(source).Expression,
            definition["includeIntoResult"]?.GetValue<bool>() ?? false);
    }
}
