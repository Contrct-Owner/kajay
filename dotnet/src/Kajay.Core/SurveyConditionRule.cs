namespace Kajay;

internal sealed record SurveyConditionRule(
    SurveyConditionalState State,
    SurveyConditionKind Kind,
    SurveyExpression Expression);
