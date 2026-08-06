using System.Globalization;

namespace Kajay;

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
        List<ExpressionPathSegment> segments = [];
        var name = new System.Text.StringBuilder();
        int position = 0;

        void FlushName()
        {
            if (name.Length == 0)
            {
                return;
            }

            segments.Add(ExpressionPathSegment.FromName(name.ToString()));
            _ = name.Clear();
        }

        while (position < raw.Length)
        {
            char character = raw[position];
            if (character == '.')
            {
                FlushName();
                position += 1;
                continue;
            }

            if (character != '[')
            {
                _ = name.Append(character);
                position += 1;
                continue;
            }

            FlushName();
            int closing = raw.IndexOf(']', position + 1);
            string indexText = closing < 0
                ? raw[(position + 1)..]
                : raw[(position + 1)..closing];
            if (closing < 0
                || !int.TryParse(
                    indexText.Trim(),
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out int index)
                || index < 0)
            {
                errors.Add(new ExpressionError("invalid-reference-index", span));
            }
            else
            {
                segments.Add(ExpressionPathSegment.FromIndex(index));
            }

            position = closing < 0 ? raw.Length : closing + 1;
        }

        FlushName();
        if (segments.Count == 0)
        {
            errors.Add(new ExpressionError("empty-reference", span));
        }

        return new ExpressionPath(segments.ToArray());
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
