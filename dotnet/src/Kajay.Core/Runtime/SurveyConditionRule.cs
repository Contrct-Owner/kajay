namespace Kajay.Runtime;

internal sealed record SurveyConditionRule(
    SurveyConditionalState State,
    SurveyConditionKind Kind,
    SurveyExpression Expression);
