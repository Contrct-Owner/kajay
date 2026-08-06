using Kajay.Demo.Api;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddSingleton<DemoSurveyApplication>();

WebApplication app = builder.Build();
app.MapOpenApi();
app.MapGet("/health", () => Results.Ok(new { status = "healthy", runtime = "dotnet" }));
app.MapDemoEndpoints();
app.Run();

public partial class Program;
