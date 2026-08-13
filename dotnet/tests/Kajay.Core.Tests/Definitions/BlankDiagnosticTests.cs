namespace Kajay.Core.Tests;

public sealed class BlankDiagnosticTests
{
    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a well-formed sentence reports nothing")]
    public void AWellFormedSentenceReportsNothing()
    {
        Assert.Empty(Diagnose("""
            {"type":"fillintheblank","name":"q","template":"The capital is [[capital]].",
             "blanks":[{"type":"text","name":"capital"}]}
            """));
    }

    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a blank nobody declared is an error")]
    public void ABlankNobodyDeclaredIsAnError()
    {
        Assert.Contains(
            new DefinitionDiagnostic("undeclared-blank", "/q", DiagnosticSeverity.Error),
            Diagnose("""
                {"type":"fillintheblank","name":"q","template":"[[capital]]","blanks":[]}
                """));
    }

    [Fact(DisplayName = "parity/Q12-blank-diagnostics: an unpositioned blank is a warning")]
    public void AnUnpositionedBlankIsAWarning()
    {
        Assert.Contains(
            new DefinitionDiagnostic("unpositioned-blank", "/q", DiagnosticSeverity.Warning),
            Diagnose("""
                {"type":"fillintheblank","name":"q","template":"[[a]]",
                 "blanks":[{"type":"text","name":"a"},{"type":"text","name":"b"}]}
                """));
    }

    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a translation may move a blank")]
    public void ATranslationMayMoveABlank()
    {
        // Word order moves between languages, which is the whole reason the template is a
        // translatable string. Set equality, not sequence equality.
        Assert.Empty(Diagnose("""
            {"type":"fillintheblank","name":"q",
             "template":{"default":"The capital is [[capital]]","de":"[[capital]] ist die Hauptstadt"},
             "blanks":[{"type":"text","name":"capital"}]}
            """));
    }

    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a translation that renames a blank is an error")]
    public void ATranslationThatRenamesABlankIsAnError()
    {
        // The answer keys would depend on the language the respondent happened to read.
        Assert.Contains(
            new DefinitionDiagnostic("locale-blank-mismatch", "/q", DiagnosticSeverity.Error),
            Diagnose("""
                {"type":"fillintheblank","name":"q",
                 "template":{"default":"is [[capital]]","fr":"est [[capitale]]"},
                 "blanks":[{"type":"text","name":"capital"}]}
                """));
    }

    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a type that cannot go inline is refused")]
    public void ATypeThatCannotGoInlineIsRefused()
    {
        // A matrix in the middle of a clause is not a layout decision but a mistake, and
        // nothing can draw it — so it is refused where the author can see it rather than
        // discovered as broken markup.
        Assert.Contains(
            new DefinitionDiagnostic("non-inline-blank", "/q", DiagnosticSeverity.Error),
            Diagnose("""
                {"type":"fillintheblank","name":"q","template":"[[grid]]",
                 "blanks":[{"type":"matrix","name":"grid"}]}
                """));
    }

    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a dropdown blank is allowed inline")]
    public void ADropdownBlankIsAllowedInline()
    {
        // The point of the reframe: a gap can be a real select, and the registry says so.
        Assert.Empty(Diagnose("""
            {"type":"fillintheblank","name":"q","template":"the capital is [[capital]]",
             "blanks":[{"type":"dropdown","name":"capital","choices":["Paris","Lyon"]}]}
            """));
    }

    private static IReadOnlyList<DefinitionDiagnostic> Diagnose(string element)
    {
        return SurveyDefinition
            .Parse($$"""{"pages":[{"name":"p1","elements":[{{element}}]}]}""")
            .Diagnostics;
    }
}
