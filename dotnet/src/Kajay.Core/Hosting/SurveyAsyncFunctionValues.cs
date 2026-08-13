namespace Kajay.Hosting;

internal sealed class SurveyAsyncFunctionValues(ExpressionFunctionRegistry functions)
    : IAsyncFunctionValueSource
{
    private readonly List<SurveyAsyncFunctionCall> _calls = [];
    private readonly List<Task> _pending = [];
    private DateTimeOffset _clock;
    private CancellationToken _cancellationToken;
    private bool _isCollecting;

    public AsyncFunctionValue GetValue(
        string name,
        IReadOnlyList<KajayValue> arguments)
    {
        SurveyAsyncFunctionCall? call = _calls.Find(
            candidate => candidate.Matches(name, arguments));
        if (call is not null || !_isCollecting)
        {
            return call?.Value ?? AsyncFunctionValue.Pending;
        }

        AsyncExpressionFunction? implementation = functions.GetAsync(name);
        if (implementation is null)
        {
            return AsyncFunctionValue.Failed($"The async function '{name}' is not registered.");
        }

        call = new SurveyAsyncFunctionCall(name, arguments, _clock);
        _calls.Add(call);
        _pending.Add(RunAsync(call, implementation, _cancellationToken));
        return AsyncFunctionValue.Pending;
    }

    /// <summary>Forgets recorded calls, so the next settle asks again.</summary>
    /// <param name="name">One function's calls, or every call when null.</param>
    /// <remarks>
    /// Recorded results are permanent by design — it is what stops each re-evaluation restarting
    /// the call that triggered it — and permanence is right until the world those answers
    /// describe moves. Failures go with them: a rejected call is recorded and never retried, so
    /// this is the only way back from a lookup that failed once.
    /// <para>
    /// A call already in flight needs no generation guard here, unlike the TypeScript cache: each
    /// call owns the object its result is written to, so a discarded call's reply lands on an
    /// object nothing reads any more while the fresh request records its own.
    /// </para>
    /// </remarks>
    internal void Invalidate(string? name)
    {
        _calls.RemoveAll(call => name is null
            || string.Equals(call.Name, name, StringComparison.OrdinalIgnoreCase));
    }

    public void Begin(DateTimeOffset clock, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _clock = clock.ToUniversalTime();
        _cancellationToken = cancellationToken;
        _pending.Clear();
        _isCollecting = true;
    }

    public async Task<bool> ResolvePendingAsync()
    {
        _isCollecting = false;
        if (_pending.Count == 0)
        {
            return false;
        }

        try
        {
            await Task.WhenAll(_pending).ConfigureAwait(false);
            return true;
        }
        catch (OperationCanceledException)
        {
            _calls.RemoveAll(call => call.Value.Kind == AsyncFunctionValueKind.Pending);
            throw;
        }
    }

    private static async Task RunAsync(
        SurveyAsyncFunctionCall call,
        AsyncExpressionFunction implementation,
        CancellationToken cancellationToken)
    {
        try
        {
            KajayValue value = await implementation(
                call.Arguments,
                new ExpressionFunctionContext(call.Clock),
                cancellationToken).ConfigureAwait(false);
            call.Value = AsyncFunctionValue.Resolved(value);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            call.Value = AsyncFunctionValue.Failed(exception.Message);
        }
    }
}
