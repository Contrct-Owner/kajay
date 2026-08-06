namespace Kajay.Expressions.Patterns;

internal static class KajayPatternSyntax
{
    public static bool IsValid(string source)
    {
        return KajayPattern.Compile(source) is not null;
    }
}
