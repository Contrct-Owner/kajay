namespace Kajay.Core.Tests;

public sealed class BlankDiagnosticTests
{
    [Fact(DisplayName = "parity/Q12-blank-diagnostics: a well-formed sentence reports nothing")]
    public void AWellFormedSentenceReportsNothing()
    {
        Assert.Empty(Diagnose("""
            {"type":"fillintheblank","name":"q","template":"The capital is [[capital]].",
             "blanks":[{"name":"capital"}]}
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
                 "blanks":[{"name":"a"},{"name":"b"}]}
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
             "blanks":[{"name":"capital"}]}
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
                 "blanks":[{"name":"capital"}]}
                """));
    }

    private static IReadOnlyList<DefinitionDiagnostic> Diagnose(string element)
    {
        return SurveyDefinition
            .Parse($$"""{"pages":[{"name":"p1","elements":[{{element}}]}]}""")
            .Diagnostics;
    }
}
