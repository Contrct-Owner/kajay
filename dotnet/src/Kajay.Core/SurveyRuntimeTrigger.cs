using System.Text.Json.Nodes;

namespace Kajay;

internal sealed record SurveyRuntimeTrigger(
    SurveyTriggerKind Kind,
    SurveyExpression Condition,
    string SetToName,
    KajayValue SetValue,
    string FromName,
    SurveyExpression? RunExpression,
    string GoToName)
{
    internal static SurveyRuntimeTrigger? From(JsonObject definition)
    {
        SurveyTriggerKind? kind = ReadKind(definition["type"]?.GetValue<string>());
        SurveyExpression? condition = SurveyExpression.Parse(
            definition["expression"]?.GetValue<string>() ?? string.Empty).Expression;
        if (kind is null || condition is null)
        {
            return null;
        }

        bool hasSetValue = definition.TryGetPropertyValue("setValue", out JsonNode? setValue);
        string runSource = definition["runExpression"]?.GetValue<string>() ?? string.Empty;
        return new SurveyRuntimeTrigger(
            kind.Value,
            condition,
            definition["setToName"]?.GetValue<string>() ?? string.Empty,
            hasSetValue ? KajayJsonValue.From(setValue) : KajayValue.From(string.Empty),
            definition["fromName"]?.GetValue<string>() ?? string.Empty,
            runSource.Length == 0 ? null : SurveyExpression.Parse(runSource).Expression,
            definition["gotoName"]?.GetValue<string>() ?? string.Empty);
    }

    private static SurveyTriggerKind? ReadKind(string? kind)
    {
        return kind switch
        {
            "complete" => SurveyTriggerKind.Complete,
            "setvalue" => SurveyTriggerKind.SetValue,
            "copyvalue" => SurveyTriggerKind.CopyValue,
            "runexpression" => SurveyTriggerKind.RunExpression,
            "skip" => SurveyTriggerKind.Skip,
            _ => null,
        };
    }
}
