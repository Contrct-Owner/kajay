namespace Kajay;

public sealed partial class Survey
{
    /// <summary>Gets a headless question by its exact authored name.</summary>
    /// <param name="name">The exact ordinal question name.</param>
    /// <returns>The bound question, or null when no question has that name.</returns>
    public SurveyQuestion? GetQuestion(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return _questionsByName.GetValueOrDefault(name);
    }

    /// <summary>Gets the current computed state for a named question.</summary>
    /// <param name="questionName">The exact ordinal question name.</param>
    /// <param name="questionState">The computed state when the question exists.</param>
    /// <returns>True when a matching question exists.</returns>
    public bool TryGetQuestionState(
        string questionName,
        out SurveyQuestionState questionState)
    {
        ArgumentNullException.ThrowIfNull(questionName);
        return _conditions.TryGetQuestionState(questionName, out questionState);
    }

    internal SurveyFileAdapters FileAdapters => _fileAdapters;

    internal bool IsAuthoredPageVisible(int pageIndex)
    {
        return _conditions.IsPageVisible(pageIndex);
    }

    private SurveyQuestion CreateQuestion(SurveyRuntimeQuestion definition)
    {
        if (_definition.Registry.TryGetQuestionFactory(
            definition.Type,
            out SurveyQuestionFactory factory))
        {
            SurveyQuestion question = factory(new SurveyQuestionFactoryContext(
                this,
                definition,
                _definition.Registry))
                ?? throw new InvalidOperationException(
                    $"Question factory for '{definition.Type}' returned null.");
            if (!ReferenceEquals(question.Owner, this)
                || !string.Equals(question.Type, definition.Type, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Question factory for '{definition.Type}' returned a question for another context.");
            }

            return question;
        }

        return definition.Type switch
        {
            "checkbox" or "dropdown" or "imagepicker" or "radiogroup" or "ranking"
                or "tagbox" => new SurveyChoiceQuestion(this, definition),
            "matrix" or "matrixcells" => new SurveyMatrixQuestion(this, definition),
            "matrixdynamic" or "paneldynamic" => new SurveyRecordQuestion(this, definition),
            "fillintheblank" => new SurveyFillInTheBlankQuestion(this, definition),
            "file" => new SurveyFileQuestion(this, definition),
            "signaturepad" => new SurveySignatureQuestion(this, definition),
            _ => new SurveyScalarQuestion(this, definition),
        };
    }

    /// <summary>Scores one question through the type that knows what right means.</summary>
    /// <param name="name">The exact question name.</param>
    /// <returns>Earned and possible marks, or nothing when no such question exists.</returns>
    internal AnswerScore ScoreQuestion(string name)
    {
        return GetQuestion(name)?.ScoreAnswer() ?? default;
    }
}
