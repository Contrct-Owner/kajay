namespace Kajay.Expressions;

internal static class ExpressionArithmetic
{
    internal static KajayValue Evaluate(
        ExpressionOperator expressionOperator,
        KajayValue left,
        KajayValue right)
    {
        bool hasLeftNumber = KajayNumber.TryConvert(left, out double leftNumber);
        bool hasRightNumber = KajayNumber.TryConvert(right, out double rightNumber);
        if (expressionOperator == ExpressionOperator.Add
            && (left.Kind == KajayValueKind.Text || right.Kind == KajayValueKind.Text)
            && (!hasLeftNumber || !hasRightNumber))
        {
            return KajayText.TryConvert(left, out string leftText)
                && KajayText.TryConvert(right, out string rightText)
                    ? KajayValue.From(string.Concat(leftText, rightText))
                    : KajayValue.Absent;
        }
        if (!hasLeftNumber || !hasRightNumber)
        {
            return KajayValue.Absent;
        }

        double value = expressionOperator switch
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
}
