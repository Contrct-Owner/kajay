using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeValidator(
    string Type,
    string Pattern,
    KajayPattern? CompiledPattern)
{
    public static SurveyRuntimeValidator From(JsonObject validator)
    {
        string pattern = validator["regex"]?.GetValue<string>() ?? string.Empty;
        return new SurveyRuntimeValidator(
            validator["type"]?.GetValue<string>() ?? string.Empty,
            pattern,
            KajayPattern.Compile(pattern));
    }
}
