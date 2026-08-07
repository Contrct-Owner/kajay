using Kajay.Workflow.Host.Api;

namespace Kajay.Workflow.Host.Definitions;

internal sealed partial class DefinitionProvenanceApplication
{
    private const int DefaultPageSize = 20;
    private const int MaximumPageSize = 100;

    private static int ReadLimit(int? value)
    {
        int limit = value ?? DefaultPageSize;
        if (limit is < 1 or > MaximumPageSize)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-page-limit",
                $"Page limit must be between 1 and {MaximumPageSize}.");
        }
        return limit;
    }

    private static string? ReadFilter(string? value, string name)
    {
        string? filter = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (filter?.Length > 128)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-page-filter",
                $"{name} must contain at most 128 characters.");
        }
        return filter;
    }

    private static string ToSearchPattern(string filter) =>
        $"%{filter.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal)}%";

    private static TCursor? ReadCursor<TCursor>(
        string? value,
        Func<string, TCursor> reader)
        where TCursor : struct
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        try
        {
            return reader(value);
        }
        catch (FormatException exception)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-pagination-cursor",
                exception.Message);
        }
    }

    private static long? ReadRevisionCursor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        try
        {
            return ProvenanceCursor.ReadRevision(value);
        }
        catch (FormatException exception)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status400BadRequest,
                "invalid-pagination-cursor",
                exception.Message);
        }
    }
}
