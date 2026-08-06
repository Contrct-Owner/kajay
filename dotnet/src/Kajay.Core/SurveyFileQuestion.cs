namespace Kajay;

/// <summary>A file question whose response is always an array of descriptors.</summary>
public sealed class SurveyFileQuestion : SurveyQuestion
{
    internal SurveyFileQuestion(Survey survey, SurveyRuntimeQuestion definition)
        : base(survey, definition)
    {
    }

    private SurveyRuntimeFileSettings Settings => Definition.FileSettings!;

    private SurveyFileAdapters Adapters => Owner.FileAdapters;

    /// <summary>Gets whether successive attachments accumulate.</summary>
    public bool AllowsMultiple => Settings.AllowMultiple;

    /// <summary>Gets whether an upload adapter is currently storing files.</summary>
    public bool IsUploading { get; private set; }

    /// <summary>Gets immutable descriptors currently stored in the response.</summary>
    public IReadOnlyList<SurveyFileEntry> Files => Array.AsReadOnly(
        (Value.Kind == KajayValueKind.Array ? Value.GetArray() : Array.Empty<KajayValue>())
            .Select(value => SurveyFileEntry.TryFrom(value, out SurveyFileEntry? entry) ? entry : null)
            .OfType<SurveyFileEntry>()
            .ToArray());

    /// <summary>Stores descriptors after an adapter has read or uploaded the files.</summary>
    /// <param name="entries">DOM-free descriptors to attach.</param>
    public void Attach(IEnumerable<SurveyFileEntry> entries)
    {
        if (Adapters.HasUploader)
        {
            throw new InvalidOperationException(
                $"Question '{Name}' has a file uploader; use AttachAsync instead.");
        }

        ArgumentNullException.ThrowIfNull(entries);
        AttachCore(ValidateEntries(entries), Settings.StoreContent);
    }

    /// <summary>Stores attachments through the configured host adapter, then commits them.</summary>
    /// <param name="entries">DOM-free descriptors to store.</param>
    /// <param name="cancellationToken">Cancels the host operation.</param>
    public async Task AttachAsync(
        IEnumerable<SurveyFileEntry> entries,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entries);
        cancellationToken.ThrowIfCancellationRequested();
        SurveyFileEntry[] incoming = ValidateEntries(entries);
        if (!Adapters.HasUploader)
        {
            AttachCore(incoming, Settings.StoreContent);
            return;
        }
        if (IsUploading)
        {
            throw new InvalidOperationException($"Question '{Name}' is already uploading files.");
        }

        IsUploading = true;
        try
        {
            IReadOnlyList<SurveyFileEntry> uploaded = await Adapters.UploadAsync(
                Name,
                AllowsMultiple ? incoming : incoming.Take(1).ToArray(),
                cancellationToken).ConfigureAwait(false);
            AttachCore(uploaded, true);
        }
        finally
        {
            IsUploading = false;
        }
    }

    /// <summary>Removes every descriptor with an exact file name.</summary>
    public void Remove(string name)
    {
        if (Adapters.HasCleaner)
        {
            throw new InvalidOperationException(
                $"Question '{Name}' has a file cleaner; use RemoveAsync instead.");
        }

        ArgumentNullException.ThrowIfNull(name);
        RemoveCore(name);
    }

    /// <summary>Detaches matching files, then awaits host-side cleanup.</summary>
    /// <param name="name">The exact file name.</param>
    /// <param name="cancellationToken">Cancels host-side cleanup.</param>
    public async Task RemoveAsync(
        string name,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(name);
        cancellationToken.ThrowIfCancellationRequested();
        SurveyFileEntry[] removed = Files.Where(
            entry => string.Equals(entry.Name, name, StringComparison.Ordinal)).ToArray();
        RemoveCore(name);
        await Adapters.CleanAsync(Name, removed, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Removes all attached files.</summary>
    public void ClearFiles()
    {
        if (Adapters.HasCleaner)
        {
            throw new InvalidOperationException(
                $"Question '{Name}' has a file cleaner; use ClearFilesAsync instead.");
        }

        Clear();
    }

    /// <summary>Detaches every file, then awaits host-side cleanup.</summary>
    /// <param name="cancellationToken">Cancels host-side cleanup.</param>
    public async Task ClearFilesAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        IReadOnlyList<SurveyFileEntry> removed = Files;
        Clear();
        await Adapters.CleanAsync(Name, removed, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Gets an existing reference or asks the host to mint a readable URL.</summary>
    /// <param name="entry">The stored descriptor.</param>
    /// <param name="cancellationToken">Cancels the host operation.</param>
    public async Task<string> ResolveUrlAsync(
        SurveyFileEntry entry,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entry);
        cancellationToken.ThrowIfCancellationRequested();
        return Adapters.HasDownloader
            ? await Adapters.DownloadAsync(Name, entry, cancellationToken).ConfigureAwait(false)
            : entry.Url ?? entry.Content ?? string.Empty;
    }

    private void AttachCore(
        IEnumerable<SurveyFileEntry> entries,
        bool includeContent)
    {
        SurveyFileEntry[] incoming = ValidateEntries(entries);
        SurveyFileEntry[] stored = AllowsMultiple
            ? [.. Files, .. incoming]
            : incoming.Take(1).ToArray();
        WriteFiles(stored, includeContent);
    }

    private void RemoveCore(string name)
    {
        SurveyFileEntry[] kept = Files.Where(
            entry => !string.Equals(entry.Name, name, StringComparison.Ordinal)).ToArray();
        WriteFiles(kept, true);
    }

    private void WriteFiles(SurveyFileEntry[] files, bool includeContent)
    {
        SetValue(files.Length == 0
            ? KajayValue.Absent
            : KajayValue.FromArray(files.Select(entry => entry.ToValue(includeContent))));
    }

    private static SurveyFileEntry[] ValidateEntries(IEnumerable<SurveyFileEntry> entries)
    {
        return entries.Select(entry =>
        {
            ArgumentNullException.ThrowIfNull(entry);
            ArgumentException.ThrowIfNullOrEmpty(entry.Name);
            ArgumentNullException.ThrowIfNull(entry.MediaType);
            ArgumentOutOfRangeException.ThrowIfNegative(entry.Size);
            return entry;
        }).ToArray();
    }
}
