namespace Kajay;

/// <summary>A host-provided choice page and whether another page exists.</summary>
/// <param name="Items">Items in source order.</param>
/// <param name="HasMore">Whether another request can return more items.</param>
public sealed record SurveyChoicePage(
    IReadOnlyList<SurveyChoiceItem> Items,
    bool HasMore);
