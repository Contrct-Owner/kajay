namespace Kajay.Validation;

internal static class SurveyValidationSnapshot
{
    internal static bool Matches(
        IReadOnlyDictionary<string, KajayValue> left,
        IReadOnlyDictionary<string, KajayValue> right)
    {
        return left.Count == right.Count
            && left.All(pair => right.TryGetValue(pair.Key, out KajayValue value)
                && value == pair.Value);
    }
}
