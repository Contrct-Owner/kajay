namespace Kajay.Workflow.Host.Authentication;

internal static class KajayPermissions
{
    internal const string WorkflowRead = "kajay:workflow:read";
    internal const string WorkflowExecute = "kajay:workflow:execute";
    internal const string WorkflowReview = "kajay:workflow:review";
    internal const string DefinitionManage = "kajay:definition:manage";
    internal const string DefinitionPromote = "kajay:definition:promote";
    internal const string DefinitionApprove = "kajay:definition:approve";
    internal const string EnvironmentManage = "kajay:environment:manage";
}
