using System.Text.Json.Nodes;

namespace Kajay.Runtime;

internal sealed record SurveyRuntimeRecordSettings(
    int MinimumCount,
    int MaximumCount,
    bool AllowAdd,
    bool AllowRemove,
    KajayValue DefaultRecord,
    bool CopyPrevious,
    IReadOnlyList<SurveyRuntimeQuestion> Fields)
{
    internal static SurveyRuntimeRecordSettings? From(
        JsonObject element,
        SurveyDefinitionRegistry registry)
    {
        string type = element["type"]?.GetValue<string>() ?? string.Empty;
        return type switch
        {
            "matrixdynamic" => new SurveyRuntimeRecordSettings(
                SurveyRuntimeQuestion.ReadCount(element["minRowCount"], 1),
                SurveyRuntimeQuestion.ReadCount(element["maxRowCount"], 0),
                element["allowAddRows"]?.GetValue<bool>() ?? true,
                element["allowRemoveRows"]?.GetValue<bool>() ?? true,
                SurveyRuntimeQuestion.ReadRecord(element["defaultRowValue"]),
                element["defaultValueFromLastRow"]?.GetValue<bool>() ?? false,
                SurveyRuntimeQuestion.ReadFields(element["columns"] as JsonArray, registry)),
            "paneldynamic" => new SurveyRuntimeRecordSettings(
                SurveyRuntimeQuestion.ReadCount(element["minPanelCount"], 1),
                SurveyRuntimeQuestion.ReadCount(element["maxPanelCount"], 0),
                element["allowAddPanel"]?.GetValue<bool>() ?? true,
                element["allowRemovePanel"]?.GetValue<bool>() ?? true,
                SurveyRuntimeQuestion.ReadRecord(element["defaultPanelValue"]),
                false,
                SurveyRuntimeQuestion.ReadFields(element["templateElements"] as JsonArray, registry)),
            _ => null,
        };
    }
}
