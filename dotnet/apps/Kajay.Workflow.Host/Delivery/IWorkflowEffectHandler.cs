namespace Kajay.Workflow.Host.Delivery;

public interface IWorkflowEffectHandler
{
    Task DeliverAsync(WorkflowEffect effect, CancellationToken cancellationToken);
}
