sealed class Q9PackQuestion : SurveyQuestion
{
    private readonly SurveyQuestionFactoryContext _context;

    public Q9PackQuestion(SurveyQuestionFactoryContext context)
        : base(context)
    {
        _context = context;
    }

    public string BadgeText => _context.GetTextProperty("badgeText");

    public double Weight => _context.GetProperty("weight")?.GetValue<double>() ?? 0;
}
