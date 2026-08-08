using Elsa.Extensions;
using Elsa.Persistence.EFCore.Extensions;
using Elsa.Persistence.EFCore.Modules.Management;
using Elsa.Persistence.EFCore.Modules.Runtime;
using Elsa.Workflows.Activities.Flowchart.Extensions;
using Kajay.Workflow.Host.Api;
using Kajay.Workflow.Host.Authentication;
using Kajay.Workflow.Host.Definitions;
using Kajay.Workflow.Host.Delivery;
using Kajay.Workflow.Host.Persistence;
using Kajay.Workflow.Host.Workflows;
using Microsoft.EntityFrameworkCore;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
string connectionString = builder.Configuration.GetConnectionString("Workflow")
    ?? throw new InvalidOperationException("Connection string 'Workflow' is required.");
builder.Services.AddDbContext<WorkflowDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(management =>
    {
        management.AddActivity<KajaySurveyActivity>();
        management.AddActivity<KajayDelayStartedActivity>();
        management.AddActivity<KajayDelayCompletedActivity>();
        management.AddActivity<KajayEffectActivity>();
        management.AddActivity<KajayReviewActivity>();
        management.AddActivity<KajayEndActivity>();
        management.UseEntityFrameworkCore(
            persistence => persistence.UsePostgreSql(connectionString));
    });
    elsa.UseWorkflowRuntime(runtime => runtime.UseEntityFrameworkCore(
        persistence => persistence.UsePostgreSql(connectionString)));
    elsa.UseScheduling(scheduling => scheduling.UseQuartzScheduler());
    elsa.UseFlowchart(flowchart => flowchart.UseTokenBasedExecution());
    elsa.UseQuartz(quartz => quartz.UsePostgreSql(
        connectionString,
        useClustering: true));
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<PromotionApplication>();
builder.Services.AddScoped<EnvironmentApplication>();
builder.Services.AddScoped<DefinitionAuthoringApplication>();
builder.Services.AddScoped<DefinitionProvenanceApplication>();
builder.Services.AddScoped<DefinitionReleaseComparisonApplication>();
builder.Services.AddScoped<WorkflowApplication>();
builder.Services.AddScoped<ReviewWorkbenchApplication>();
builder.Services.AddScoped<ElsaWorkflowEngine>();
builder.Services.AddScoped<WorkflowProjection>();
builder.Services.AddScoped<WorkflowResumeProcessor>();
builder.Services.AddScoped<WorkflowResumeLeaseStore>();
builder.Services.AddScoped<WorkflowReleaseResolver>();
builder.Services.AddScoped<IdempotencyCoordinator>();
builder.Services.AddScoped<WorkflowAudit>();
builder.Services.AddScoped<WorkflowOperationsApplication>();
builder.Services.AddScoped<WorkflowWorkerApplication>();
builder.Services.AddScoped<OutboxLeaseStore>();
builder.Services.AddSingleton<IWorkflowEffectHandler, LoggingWorkflowEffectHandler>();
builder.Services.AddWorkOSAuthentication(builder.Configuration);
builder.Services.Configure<WorkflowWorkerOptions>(
    builder.Configuration.GetSection(WorkflowWorkerOptions.SectionName));
builder.Services.AddHostedService<DatabaseMigrationService>();
builder.Services.AddHostedService<WorkflowResumeDispatcher>();
if (builder.Configuration.GetValue<bool>($"{WorkflowWorkerOptions.SectionName}:Enabled", true))
{
    builder.Services.AddHostedService<OutboxDispatcher>();
}
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<WorkflowExceptionHandler>();
builder.Services.AddOpenApi();

WebApplication app = builder.Build();
app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
app.MapWorkOSSessionEndpoints();
app.MapOpenApi().RequireAuthorization(KajayPolicies.DefinitionManage);
app.MapGet("/health", () => Results.Ok(new { status = "healthy", runtime = "dotnet" }));
app.MapPromotionEndpoints();
app.MapEnvironmentEndpoints();
app.MapDefinitionAuthoringEndpoints();
app.MapWorkflowEndpoints();
app.Run();

public partial class Program;
