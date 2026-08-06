using System.Text;

namespace Kajay;

internal sealed class SurveyChoiceUrlResolver(
    Survey survey,
    IReadOnlyDictionary<string, string> endpoints)
{
    public string Resolve(string questionName, string template)
    {
        var resolved = new StringBuilder(template.Length);
        int position = 0;
        while (position < template.Length)
        {
            int opening = template.IndexOf('{', position);
            if (opening < 0)
            {
                _ = resolved.Append(template, position, template.Length - position);
                break;
            }

            _ = resolved.Append(template, position, opening - position);
            int closing = template.IndexOf('}', opening + 1);
            if (closing < 0)
            {
                _ = resolved.Append(template, opening, template.Length - opening);
                break;
            }

            string name = template[(opening + 1)..closing];
            _ = resolved.Append(ResolvePlaceholder(questionName, template, name));
            position = closing + 1;
        }

        return resolved.ToString();
    }

    private string ResolvePlaceholder(
        string questionName,
        string template,
        string name)
    {
        if (name.StartsWith('@'))
        {
            string endpointName = name[1..];
            if (endpoints.TryGetValue(endpointName, out string? endpoint))
            {
                return endpoint;
            }

            throw new SurveyChoiceLoadException(
                questionName,
                template,
                $"The choice source names endpoint '{endpointName}', which the host did not supply.");
        }

        KajayValue value = survey.ResolveValuePath(name);
        if (!KajayText.TryConvert(value, out string text))
        {
            throw new SurveyChoiceLoadException(
                questionName,
                template,
                $"The choice source placeholder '{name}' must resolve to a scalar value.");
        }

        return Uri.EscapeDataString(text);
    }
}
