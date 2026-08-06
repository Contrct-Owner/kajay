namespace Kajay.Workflow.Host.Api;

internal static class BundleRequestReader
{
    private const int MaximumBundleBytes = 10 * 1024 * 1024;

    internal static async Task<byte[]> ReadAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ContentLength is > MaximumBundleBytes)
        {
            throw new WorkflowProblemException(
                StatusCodes.Status413PayloadTooLarge,
                "bundle-too-large",
                "A .kajay bundle cannot exceed 10 MiB.");
        }

        using var output = new MemoryStream();
        byte[] buffer = new byte[81920];
        while (true)
        {
            int read = await request.Body.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (read == 0)
            {
                return output.ToArray();
            }
            if (output.Length > MaximumBundleBytes - read)
            {
                throw new WorkflowProblemException(
                    StatusCodes.Status413PayloadTooLarge,
                    "bundle-too-large",
                    "A .kajay bundle cannot exceed 10 MiB.");
            }
            await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken)
                .ConfigureAwait(false);
        }
    }
}
