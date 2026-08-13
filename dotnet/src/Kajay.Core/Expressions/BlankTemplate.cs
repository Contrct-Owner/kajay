using System.Text.RegularExpressions;

namespace Kajay.Expressions;

/// <summary>What a blank template is made of: prose, or a gap the respondent types into.</summary>
public enum BlankSegmentKind
{
    /// <summary>Literal prose, drawn as written.</summary>
    Text,

    /// <summary>A gap, named by the marker that positioned it.</summary>
    Blank,
}

/// <summary>One piece of a fill-in-the-blank template.</summary>
/// <param name="Kind">Whether this piece is prose or a gap.</param>
/// <param name="Value">The prose, or the blank's name.</param>
public readonly record struct BlankSegment(BlankSegmentKind Kind, string Value);

/// <summary>
/// Splits fill-in-the-blank prose into the text around its blanks and the blanks themselves.
/// </summary>
/// <remarks>
/// <para>
/// <c>[[</c> opens a blank only when a valid name and <c>]]</c> follow. Anything else is
/// text, so prose containing a bracket pair needs no escape — and an escape character is
/// what this avoids, because it would land in authored prose and in every translator's copy
/// of it. The stated cost is that a literal <c>[[capital]]</c> cannot be written.
/// </para>
/// <para>
/// A name takes the shape of a reference path segment, because a blank's answer lives in an
/// object under the question's name and is read from an expression as <c>{q.capital}</c>. A
/// name carrying a dot or a bracket would be unreachable from the language meant to read it.
/// </para>
/// </remarks>
public static partial class BlankTemplate
{
    /// <summary>Splits prose into its segments, in the order the author wrote them.</summary>
    /// <param name="template">The authored prose.</param>
    /// <returns>Text and blank segments, with no empty text between adjacent blanks.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="template"/> is null.</exception>
    public static IReadOnlyList<BlankSegment> Parse(string template)
    {
        ArgumentNullException.ThrowIfNull(template);
        List<BlankSegment> segments = [];
        int index = 0;
        foreach (Match match in Marker().Matches(template))
        {
            if (match.Index > index)
            {
                segments.Add(new BlankSegment(
                    BlankSegmentKind.Text,
                    template[index..match.Index]));
            }

            segments.Add(new BlankSegment(BlankSegmentKind.Blank, match.Groups[1].Value));
            index = match.Index + match.Length;
        }

        if (index < template.Length)
        {
            segments.Add(new BlankSegment(BlankSegmentKind.Text, template[index..]));
        }

        return Array.AsReadOnly(segments.ToArray());
    }

    /// <summary>Gets every blank the template positions, in order, without repeats.</summary>
    /// <param name="template">The authored prose.</param>
    /// <returns>The distinct blank names, in first-appearance order.</returns>
    public static IReadOnlyList<string> NamesIn(string template)
    {
        return Array.AsReadOnly(Parse(template)
            .Where(segment => segment.Kind == BlankSegmentKind.Blank)
            .Select(segment => segment.Value)
            .Distinct(StringComparer.Ordinal)
            .ToArray());
    }

    [GeneratedRegex(@"\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]", RegexOptions.CultureInvariant)]
    private static partial Regex Marker();
}
