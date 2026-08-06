namespace Kajay.Expressions;

internal readonly record struct AsyncFunctionValue
{
    private AsyncFunctionValue(
        AsyncFunctionValueKind kind,
        KajayValue value,
        string? failure)
    {
        Kind = kind;
        Value = value;
        Failure = failure;
    }

    public static AsyncFunctionValue Pending => default;

    public AsyncFunctionValueKind Kind { get; }

    public KajayValue Value { get; }

    public string? Failure { get; }

    public static AsyncFunctionValue Resolved(KajayValue value)
    {
        return new AsyncFunctionValue(AsyncFunctionValueKind.Resolved, value, null);
    }

    public static AsyncFunctionValue Failed(string message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(message);
        return new AsyncFunctionValue(
            AsyncFunctionValueKind.Failed,
            KajayValue.Absent,
            message);
    }
}

internal enum AsyncFunctionValueKind
{
    Pending,
    Resolved,
    Failed,
}
