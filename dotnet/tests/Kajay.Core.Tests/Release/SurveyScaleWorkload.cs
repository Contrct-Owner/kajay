using System.Text.Json.Nodes;

namespace Kajay.Core.Tests;

internal static class SurveyScaleWorkload
{
    internal static string CreateDefinition(SurveyScale scale)
    {
        var pages = new JsonArray();
        for (int offset = 0; offset < scale.QuestionCount; offset += scale.QuestionsPerPage)
        {
            var elements = new JsonArray();
            int end = Math.Min(offset + scale.QuestionsPerPage, scale.QuestionCount);
            for (int index = offset; index < end; index += 1)
            {
                elements.Add(new JsonObject
                {
                    ["type"] = "text",
                    ["name"] = $"q{index}",
                    ["isRequired"] = true,
                });
            }

            pages.Add(new JsonObject
            {
                ["name"] = $"page{pages.Count}",
                ["elements"] = elements,
            });
        }

        var calculatedValues = new JsonArray();
        for (int index = 0; index < scale.LogicRuleCount; index += 1)
        {
            calculatedValues.Add(new JsonObject
            {
                ["name"] = $"c{index}",
                ["expression"] = $"{{q{index % scale.QuestionCount}}} notempty",
                ["includeIntoResult"] = true,
            });
        }

        return new JsonObject
        {
            ["pages"] = pages,
            ["calculatedValues"] = calculatedValues,
        }.ToJsonString();
    }

    internal static void MaterializeAnswers(Survey survey, SurveyScale scale)
    {
        int leavesPerAnswer = scale.AnswerLeafCount / scale.QuestionCount;
        KajayValue answer = KajayValue.FromArray(
            Enumerable.Range(0, leavesPerAnswer).Select(index => KajayValue.From(index)));
        foreach (SurveyQuestion question in survey.Questions)
        {
            question.SetValue(answer);
        }
    }
}
