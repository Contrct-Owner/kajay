using System.Reflection;
using System.Runtime.Versioning;

namespace Kajay.Core.Tests;

public sealed class PackageSkeletonTests
{
    [Fact(DisplayName = "parity/Q1-package-skeleton")]
    public void PackageAssemblyTargetsNet10AndReferencesOnlyTheBcl()
    {
        System.Reflection.Assembly assembly = typeof(KajayContracts).Assembly;
        TargetFrameworkAttribute framework = Assert.Single(
            assembly.GetCustomAttributes<TargetFrameworkAttribute>());

        Assert.Equal(".NETCoreApp,Version=v10.0", framework.FrameworkName);
        Assert.DoesNotContain(
            assembly.GetReferencedAssemblies(),
            reference => reference.Name is not null
                && !reference.Name.StartsWith("System", StringComparison.Ordinal));
    }
}
