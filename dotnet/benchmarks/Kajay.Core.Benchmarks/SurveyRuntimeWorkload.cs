using System.Text.Json.Nodes;

namespace Kajay.Core.Benchmarks;

internal static class SurveyRuntimeWorkload
{
    internal static string CreateDefinition(int questionCount, int logicRuleCount)
    {
        var elements = new JsonArray();
        for (int index = 0; index < questionCount; index += 1)
        {
            elements.Add(new JsonObject
            {
                ["type"] = "text",
                ["name"] = $"q{index}",
                ["isRequired"] = true,
            });
        }

        var calculatedValues = new JsonArray();
        for (int index = 0; index < logicRuleCount; index += 1)
        {
            calculatedValues.Add(new JsonObject
            {
                ["name"] = $"c{index}",
                ["expression"] = $"{{q{index % questionCount}}} notempty",
                ["includeIntoResult"] = true,
            });
        }

        return new JsonObject
        {
            ["pages"] = new JsonArray
            {
                new JsonObject { ["name"] = "only", ["elements"] = elements },
            },
            ["calculatedValues"] = calculatedValues,
        }.ToJsonString();
    }

    internal static void MaterializeAnswers(Survey survey)
    {
        foreach (SurveyQuestion question in survey.Questions)
        {
            question.SetValue(KajayValue.From("answer"));
        }
    }
}
