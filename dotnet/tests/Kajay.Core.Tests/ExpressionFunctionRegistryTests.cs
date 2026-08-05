namespace Kajay.Core.Tests;

public sealed class ExpressionFunctionRegistryTests
{
    [Fact]
    public void AddReturnsANewRegistryWithoutMutatingTheOriginal()
    {
        ExpressionFunctionRegistry original = ExpressionFunctionRegistry.Empty;
        ExpressionFunctionRegistry extended = original.Add(
            "doubleValue",
            static (arguments, _) => KajayValue.From(arguments[0].GetNumber() * 2));
        SurveyExpression expression = SurveyExpression.Parse("doubleValue(21)").Expression!;

        ExpressionEvaluationResult originalResult = expression.Evaluate(
            new ExpressionEvaluationContext(DateTimeOffset.UnixEpoch, original));
        ExpressionEvaluationResult extendedResult = expression.Evaluate(
            new ExpressionEvaluationContext(DateTimeOffset.UnixEpoch, extended));

        Assert.Equal("unknown-function", Assert.Single(originalResult.Errors).Code);
        Assert.Empty(extendedResult.Errors);
        Assert.Equal(42, extendedResult.Value.GetNumber());
    }

    [Fact]
    public void SyncAndAsyncFunctionsShareOneCaseInsensitiveNamespace()
    {
        ExpressionFunctionRegistry functions = ExpressionFunctionRegistry.Empty.AddAsync(
            "lookup",
            static (_, _, _) => ValueTask.FromResult(KajayValue.Null));

        ArgumentException error = Assert.Throws<ArgumentException>(() => functions.Add(
            "LOOKUP",
            static (_, _) => KajayValue.Null));

        Assert.Equal("name", error.ParamName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("1lookup")]
    [InlineData("look-up")]
    [InlineData("today")]
    public void InvalidAndReservedNamesAreRejected(string name)
    {
        ArgumentException error = Assert.Throws<ArgumentException>(() =>
            ExpressionFunctionRegistry.Empty.Add(
                name,
                static (_, _) => KajayValue.Null));

        Assert.Equal("name", error.ParamName);
    }
}
