using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeValidator(
    string Type,
    string Message,
    string Pattern,
    KajayPattern? CompiledPattern,
    double? Minimum,
    double? Maximum,
    bool AllowDigits,
    SurveyExpression? Expression)
{
    public static SurveyRuntimeValidator From(JsonObject validator)
    {
        string pattern = validator["regex"]?.GetValue<string>() ?? string.Empty;
        string expression = validator["expression"]?.GetValue<string>() ?? string.Empty;
        return new SurveyRuntimeValidator(
            validator["type"]?.GetValue<string>() ?? string.Empty,
            validator["text"]?.GetValue<string>() ?? string.Empty,
            pattern,
            KajayPattern.Compile(pattern),
            ReadBound(validator, "minValue", "minLength", "minCount"),
            ReadBound(validator, "maxValue", "maxLength", "maxCount"),
            validator["allowDigits"]?.GetValue<bool>() ?? true,
            expression.Length == 0 ? null : SurveyExpression.Parse(expression).Expression);
    }

    private static double? ReadBound(JsonObject validator, params string[] names)
    {
        foreach (string name in names)
        {
            if (validator[name] is JsonValue value && value.TryGetValue(out double bound))
            {
                return bound;
            }
        }

        return null;
    }
}
