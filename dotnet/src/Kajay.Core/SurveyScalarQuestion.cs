namespace Kajay;

/// <summary>A question whose response uses the scalar or direct composite value API.</summary>
public sealed class SurveyScalarQuestion : SurveyQuestion
{
    internal SurveyScalarQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }
}
