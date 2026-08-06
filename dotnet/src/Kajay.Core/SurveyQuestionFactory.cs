namespace Kajay;

/// <summary>Creates a host-defined question bound to one survey instance.</summary>
/// <param name="context">The owning survey and canonical authored properties.</param>
/// <returns>A new question owned by <paramref name="context"/>.</returns>
public delegate SurveyQuestion SurveyQuestionFactory(SurveyQuestionFactoryContext context);
