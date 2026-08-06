using Kajay.Workflow.Host.Delivery;

namespace Kajay.Workflow.Host.Tests;

internal sealed class FailingWorkflowEffectHandler : IWorkflowEffectHandler
{
    public Task DeliverAsync(WorkflowEffect effect, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        throw new InvalidOperationException($"Effect '{effect.Id}' was rejected by the test adapter.");
    }
}
