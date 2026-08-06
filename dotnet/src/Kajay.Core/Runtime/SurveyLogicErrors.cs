namespace Kajay.Runtime;

internal sealed class SurveyLogicErrors
{
    private readonly List<ExpressionError> _errors = [];

    public IReadOnlyList<ExpressionError> Current => Array.AsReadOnly(_errors.ToArray());

    public void Reset()
    {
        _errors.Clear();
    }

    public void Record(IReadOnlyList<ExpressionError> errors)
    {
        _errors.AddRange(errors);
    }
}
