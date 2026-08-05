namespace Kajay;

internal static class ExpressionEvaluator
{
    public static ExpressionEvaluationResult Evaluate(
        ExpressionNode root,
        ExpressionEvaluationContext context)
    {
        List<ExpressionError> errors = [];
        KajayValue value = EvaluateNode(root, context, errors);
        return new ExpressionEvaluationResult(value, errors);
    }

    private static KajayValue EvaluateNode(
        ExpressionNode node,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        return node switch
        {
            ExpressionNode.Literal literal => EvaluateLiteral(literal),
            ExpressionNode.Reference reference => EvaluateReference(reference, context),
            ExpressionNode.Array array => EvaluateArray(array, context, errors),
            ExpressionNode.Postfix postfix => EvaluatePostfix(postfix, context, errors),
            ExpressionNode.Binary binary => EvaluateBinary(binary, context, errors),
            ExpressionNode.Call call => EvaluateCall(call, context, errors),
            _ => KajayValue.Absent,
        };
    }

    private static KajayValue EvaluateLiteral(ExpressionNode.Literal literal)
    {
        return literal.Value switch
        {
            null => KajayValue.Null,
            bool value => KajayValue.From(value),
            double value => KajayValue.From(value),
            string value => KajayValue.From(value),
            _ => throw new InvalidOperationException("Unknown expression literal kind."),
        };
    }

    private static KajayValue EvaluateReference(
        ExpressionNode.Reference reference,
        ExpressionEvaluationContext context)
    {
        return context.Values.TryGetValue(reference.Path, out KajayValue value)
            ? value
            : KajayValue.Absent;
    }

    private static KajayValue EvaluateArray(
        ExpressionNode.Array array,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        return KajayValue.FromArray(
            array.Items.Select(item => EvaluateNode(item, context, errors)));
    }

    private static KajayValue EvaluatePostfix(
        ExpressionNode.Postfix postfix,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        bool empty = KajayValueSemantics.IsEmpty(
            EvaluateNode(postfix.Operand, context, errors));
        return KajayValue.From(
            postfix.Operator == ExpressionOperator.Empty ? empty : !empty);
    }

    private static KajayValue EvaluateCall(
        ExpressionNode.Call call,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        if (KajayBuiltInFunctions.IsRegistered(call.Name))
        {
            IReadOnlyList<KajayValue> arguments = call.Arguments
                .Select(argument => EvaluateNode(argument, context, errors))
                .ToArray();
            return KajayBuiltInFunctions.Evaluate(call.Name, arguments, context.Clock);
        }

        if (context.Functions.IsAsync(call.Name))
        {
            return EvaluateAsyncCall(call, context, errors);
        }

        ExpressionFunction? implementation = context.Functions.Get(call.Name);
        if (implementation is not null)
        {
            IReadOnlyList<KajayValue> arguments = call.Arguments
                .Select(argument => EvaluateNode(argument, context, errors))
                .ToArray();
            try
            {
                return implementation(
                    arguments,
                    new ExpressionFunctionContext(context.Clock));
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                errors.Add(new ExpressionError(
                    "function-failed",
                    call.Span,
                    exception.Message));
                return KajayValue.Absent;
            }
        }

        errors.Add(new ExpressionError("unknown-function", call.Span));
        return KajayValue.Absent;
    }

    private static KajayValue EvaluateAsyncCall(
        ExpressionNode.Call call,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        IAsyncFunctionValueSource? values = context.AsyncFunctionValues;
        if (values is null)
        {
            errors.Add(new ExpressionError("async-unavailable", call.Span));
            return KajayValue.Absent;
        }

        IReadOnlyList<KajayValue> arguments = call.Arguments
            .Select(argument => EvaluateNode(argument, context, errors))
            .ToArray();
        AsyncFunctionValue outcome = values.GetValue(call.Name, arguments);
        if (outcome.Kind == AsyncFunctionValueKind.Failed)
        {
            errors.Add(new ExpressionError(
                "function-failed",
                call.Span,
                outcome.Failure));
        }

        return outcome.Kind == AsyncFunctionValueKind.Resolved
            ? outcome.Value
            : KajayValue.Absent;
    }

    private static KajayValue EvaluateBinary(
        ExpressionNode.Binary binary,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        if (binary.Operator is ExpressionOperator.And or ExpressionOperator.Or)
        {
            return EvaluateLogical(binary, context, errors);
        }

        KajayValue left = EvaluateNode(binary.Left, context, errors);
        KajayValue right = EvaluateNode(binary.Right, context, errors);
        if (binary.Operator is ExpressionOperator.Equal or ExpressionOperator.NotEqual)
        {
            bool equal = KajayExpressionEquality.Equals(left, right);
            return KajayValue.From(
                binary.Operator == ExpressionOperator.Equal ? equal : !equal);
        }

        if (binary.Operator is ExpressionOperator.Contains
            or ExpressionOperator.NotContains
            or ExpressionOperator.AnyOf
            or ExpressionOperator.AllOf)
        {
            return KajayValue.From(KajayMembership.Evaluate(binary.Operator, left, right));
        }

        if (!KajayNumber.TryConvert(left, out double leftNumber)
            || !KajayNumber.TryConvert(right, out double rightNumber))
        {
            return KajayValue.Absent;
        }

        double value = binary.Operator switch
        {
            ExpressionOperator.Add => leftNumber + rightNumber,
            ExpressionOperator.Subtract => leftNumber - rightNumber,
            ExpressionOperator.Multiply => leftNumber * rightNumber,
            ExpressionOperator.Divide when rightNumber != 0 => leftNumber / rightNumber,
            ExpressionOperator.Remainder when rightNumber != 0 => leftNumber % rightNumber,
            ExpressionOperator.Power => Math.Pow(leftNumber, rightNumber),
            _ => double.NaN,
        };
        return double.IsFinite(value) ? KajayValue.From(value) : KajayValue.Absent;
    }

    private static KajayValue EvaluateLogical(
        ExpressionNode.Binary binary,
        ExpressionEvaluationContext context,
        List<ExpressionError> errors)
    {
        bool left = KajayValueSemantics.IsTruthy(
            EvaluateNode(binary.Left, context, errors));
        if (binary.Operator == ExpressionOperator.And && !left
            || binary.Operator == ExpressionOperator.Or && left)
        {
            return KajayValue.From(left);
        }

        return KajayValue.From(KajayValueSemantics.IsTruthy(
            EvaluateNode(binary.Right, context, errors)));
    }
}
