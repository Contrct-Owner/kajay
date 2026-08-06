using System.Globalization;

namespace Kajay.Expressions;

internal sealed record ExpressionPath(IReadOnlyList<ExpressionPathSegment> Segments)
{
    internal static ExpressionPath FromName(string name)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        return new ExpressionPath([ExpressionPathSegment.FromName(name)]);
    }

    internal static ExpressionPath Parse(
        string raw,
        TextSpan span,
        ICollection<ExpressionError> errors)
    {
        return ExpressionPathParser.Parse(raw, span, errors);
    }

    internal string Format()
    {
        var output = new System.Text.StringBuilder();
        foreach (ExpressionPathSegment segment in Segments)
        {
            if (segment.IsIndex)
            {
                _ = output.Append(CultureInfo.InvariantCulture, $"[{segment.Index}]");
            }
            else
            {
                if (output.Length > 0)
                {
                    _ = output.Append('.');
                }

                _ = output.Append(segment.Name);
            }
        }

        return output.ToString();
    }
}
