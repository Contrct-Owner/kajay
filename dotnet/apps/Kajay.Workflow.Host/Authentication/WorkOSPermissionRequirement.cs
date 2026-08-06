using Microsoft.AspNetCore.Authorization;

namespace Kajay.Workflow.Host.Authentication;

internal sealed record WorkOSPermissionRequirement(string Permission) : IAuthorizationRequirement;
