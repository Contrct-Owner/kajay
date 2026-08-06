namespace Kajay.Workflow.Host.Tests;

[CollectionDefinition(Name)]
public sealed class WorkflowHostTestGroup : ICollectionFixture<WorkflowHostFixture>
{
    public const string Name = "workflow-host-postgres";
}
