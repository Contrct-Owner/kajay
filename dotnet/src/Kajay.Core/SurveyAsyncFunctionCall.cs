namespace Kajay;

internal sealed class SurveyAsyncFunctionCall(
    string name,
    IReadOnlyList<KajayValue> arguments,
    DateTimeOffset clock)
{
    public string Name { get; } = name;

    public IReadOnlyList<KajayValue> Arguments { get; } = Array.AsReadOnly(arguments.ToArray());

    public DateTimeOffset Clock { get; } = clock;

    public AsyncFunctionValue Value { get; set; } = AsyncFunctionValue.Pending;

    public bool Matches(
        string candidateName,
        IReadOnlyList<KajayValue> candidateArguments)
    {
        return string.Equals(Name, candidateName, StringComparison.OrdinalIgnoreCase)
            && Arguments.SequenceEqual(candidateArguments);
    }
}
