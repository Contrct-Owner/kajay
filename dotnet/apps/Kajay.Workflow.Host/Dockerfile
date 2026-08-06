FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /workspace
COPY dotnet dotnet
COPY contracts contracts
WORKDIR /workspace/dotnet
RUN dotnet restore apps/Kajay.Workflow.Host/Kajay.Workflow.Host.csproj
RUN dotnet publish apps/Kajay.Workflow.Host/Kajay.Workflow.Host.csproj \
    --configuration Release \
    --no-restore \
    --property:PublishRepositoryUrl=false \
    --property:EmbedUntrackedSources=false \
    --property:EnableSourceControlManagerQueries=false \
    --property:EnableSourceLink=false \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Kajay.Workflow.Host.dll"]
