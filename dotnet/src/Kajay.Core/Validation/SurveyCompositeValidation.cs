using System.Globalization;

namespace Kajay.Validation;

internal sealed class SurveyCompositeValidation(Survey survey)
{
    public void Validate(
        SurveyRuntimeQuestion question,
        KajayValue value,
        List<SurveyValidationError> errors)
    {
        ValidateMatrix(question, value, errors);
        ValidateRecords(question, value, errors);
    }

    private void ValidateMatrix(
        SurveyRuntimeQuestion question, KajayValue value, List<SurveyValidationError> errors)
    {
        SurveyRuntimeMatrixSettings? settings = question.MatrixSettings;
        if (settings is null)
        {
            return;
        }

        IReadOnlyDictionary<string, KajayValue> response = value.Kind == KajayValueKind.Map
            ? value.GetObject()
            : new Dictionary<string, KajayValue>(StringComparer.Ordinal);
        var selected = new List<KajayValue>();
        foreach (KajayValue row in question.Rows)
        {
            if (!KajayText.TryConvert(row, out string path))
            {
                continue;
            }

            KajayValue answer = response.GetValueOrDefault(path);
            if (settings.RequireEveryRow && KajayValueSemantics.IsEmpty(answer))
            {
                errors.Add(new SurveyValidationError(
                    question.Name,
                    "required",
                    survey.ResolveText(question.RequiredMessage),
                    path));
            }
            else if (settings.RequireUniqueColumns
                && selected.Any(previous => KajayExpressionEquality.Equals(previous, answer)))
            {
                errors.Add(new SurveyValidationError(question.Name, "matrixunique", Path: path));
            }

            if (!KajayValueSemantics.IsEmpty(answer))
            {
                selected.Add(answer);
            }

            if (settings.Fields.Count > 0)
            {
                KajayValue record = answer.Kind == KajayValueKind.Map
                    ? answer
                    : KajayValue.FromObject([]);
                ValidateRecord(question, settings.Fields, record, path, "row", errors);
            }
        }
    }

    private void ValidateRecords(
        SurveyRuntimeQuestion question,
        KajayValue value,
        List<SurveyValidationError> errors)
    {
        SurveyRuntimeRecordSettings? settings = question.RecordSettings;
        if (settings is null)
        {
            return;
        }

        IReadOnlyList<KajayValue> stored = value.Kind == KajayValueKind.Array
            ? value.GetArray()
            : Array.Empty<KajayValue>();
        int count = Math.Max(settings.MinimumCount, stored.Count);
        for (int index = 0; index < count; index += 1)
        {
            KajayValue record = index < stored.Count && stored[index].Kind == KajayValueKind.Map
                ? stored[index]
                : KajayValue.FromObject([]);
            string alias = question.Type == "paneldynamic" ? "panel" : "row";
            ValidateRecord(
                question,
                settings.Fields,
                record,
                index.ToString(CultureInfo.InvariantCulture),
                alias,
                errors);
        }
    }

    private void ValidateRecord(
        SurveyRuntimeQuestion owner,
        IReadOnlyList<SurveyRuntimeQuestion> fields,
        KajayValue record,
        string path,
        string alias,
        List<SurveyValidationError> errors)
    {
        ExpressionEvaluationContext context = survey.CreateExpressionContext(
            [new KeyValuePair<string, KajayValue>(alias, record)]);
        foreach (SurveyRuntimeQuestion field in fields)
        {
            if (!IsTruthy(field.VisibleIf, context, true))
            {
                continue;
            }

            KajayValue value = record.GetObject().GetValueOrDefault(field.ValueKey);
            bool required = field.AuthoredRequired || IsTruthy(field.RequiredIf, context, false);
            if (required && KajayValueSemantics.IsEmpty(value))
            {
                errors.Add(new SurveyValidationError(
                    owner.Name,
                    "required",
                    survey.ResolveText(field.RequiredMessage),
                    $"{path}.{field.Name}"));
            }
        }
    }

    private static bool IsTruthy(
        SurveyExpression? expression,
        ExpressionEvaluationContext context,
        bool fallback)
    {
        if (expression is null)
        {
            return fallback;
        }

        ExpressionEvaluationResult result = expression.Evaluate(context);
        return result.Errors.Count == 0
            ? KajayValueSemantics.IsTruthy(result.Value)
            : fallback;
    }
}
