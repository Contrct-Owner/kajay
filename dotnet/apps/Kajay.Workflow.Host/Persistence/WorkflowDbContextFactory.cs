using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Kajay.Workflow.Host.Persistence;

internal sealed class WorkflowDbContextFactory : IDesignTimeDbContextFactory<WorkflowDbContext>
{
    public WorkflowDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<WorkflowDbContext>()
            .UseNpgsql("Host=localhost;Database=kajay;Username=kajay;Password=kajay")
            .Options;
        return new WorkflowDbContext(options);
    }
}
