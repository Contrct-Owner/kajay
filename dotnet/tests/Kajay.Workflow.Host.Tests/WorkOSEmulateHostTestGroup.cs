namespace Kajay.Workflow.Host.Tests;

[CollectionDefinition(Name)]
public sealed class WorkOSEmulateHostTestGroup : ICollectionFixture<WorkOSEmulateHostFixture>
{
    public const string Name = "workflow-host-workos-emulate";
}
