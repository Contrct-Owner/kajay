namespace Kajay.Expressions;

internal interface IAsyncFunctionValueSource
{
    AsyncFunctionValue GetValue(
        string name,
        IReadOnlyList<KajayValue> arguments);
}
