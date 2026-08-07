using System.CommandLine;

namespace Kajay.Cli;

internal static class KajayCli
{
    internal static RootCommand Create(Func<string, string?> readEnvironment)
    {
        var root = new RootCommand("Promote and operate Kajay workflow releases.");
        root.Subcommands.Add(PromoteCommand.Create(readEnvironment));
        return root;
    }
}
