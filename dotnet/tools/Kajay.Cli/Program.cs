using System.CommandLine;

namespace Kajay.Cli;

internal static class EntryPoint
{
    private static async Task<int> Main(string[] args)
    {
        RootCommand root = KajayCli.Create(Environment.GetEnvironmentVariable);
        return await root.Parse(args).InvokeAsync().ConfigureAwait(false);
    }
}
