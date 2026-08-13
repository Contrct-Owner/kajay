namespace Kajay.Core.Tests;

public sealed class ReservedNameDiagnosticTests
{
    [Fact]
    public void AnElementNamedIntoTheHostScopeIsAnError()
    {
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"text","name":"$tier"}]}]}
            """);

        // Error, not warning: resolution tests the sigil before it consults the answers, so
        // this element is unreachable from every expression rather than merely confusing.
        Assert.Contains(
            new DefinitionDiagnostic(
                "reserved-name-sigil",
                "/pages/0/elements/0/name",
                DiagnosticSeverity.Error),
            parsed.Diagnostics);
    }

    [Fact]
    public void TheAuthoredNameIsKeptRatherThanRewritten()
    {
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"text","name":"$tier"}]}]}
            """);

        // A parser that quietly renamed an element would break every response already
        // recorded against it, and the round trip is a fixed point.
        Assert.Contains("$tier", parsed.Definition.ToCanonicalJson());
    }

    [Fact]
    public void AnOrdinaryNameIsNotReported()
    {
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[{"type":"text","name":"tier"}]}]}
            """);

        Assert.DoesNotContain(
            parsed.Diagnostics,
            diagnostic => diagnostic.Code == "reserved-name-sigil");
    }

    [Fact]
    public void AReferenceToTheScopeIsNotItselfAReservedName()
    {
        SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"p1","elements":[
              {"type":"text","name":"upgrade","visibleIf":"{$tier} = 'gold'"}]}]}
            """);

        // Only `name` is reserved. Reading the scope is the entire point of it.
        Assert.DoesNotContain(
            parsed.Diagnostics,
            diagnostic => diagnostic.Code == "reserved-name-sigil");
    }
}
