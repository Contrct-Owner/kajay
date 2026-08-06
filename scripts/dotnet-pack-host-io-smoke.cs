SurveyChoiceFetchRequest? q8ChoiceRequest = null;
var q8Cleaned = new List<string>();
bool q8BlockDownload = false;
var q8DownloadStarted = new System.Threading.Tasks.TaskCompletionSource(
    System.Threading.Tasks.TaskCreationOptions.RunContinuationsAsynchronously);
ExpressionFunctionRegistry q8Functions = ExpressionFunctionRegistry.Empty.AddAsync(
    "lookup",
    (arguments, _, cancellationToken) =>
    {
        cancellationToken.ThrowIfCancellationRequested();
        return System.Threading.Tasks.ValueTask.FromResult(arguments[0].Kind == KajayValueKind.Text
            ? KajayValue.From("ready")
            : KajayValue.Absent);
    });
Survey q8Survey = SurveyDefinition.Parse(
    """{"calculatedValues":[{"name":"status","expression":"lookup({region})","includeIntoResult":true}],"pages":[{"name":"start","elements":[{"type":"text","name":"region"},{"type":"dropdown","name":"country","choicesByUrl":"{@catalog}/{region}","choicesValueName":"code","choicesTitleName":"title"},{"type":"file","name":"receipt"}]},{"name":"branch","visibleIf":"{status} = 'ready'"}]}""")
    .Definition
    .CreateSurvey(new SurveyOptions
    {
        ExpressionFunctions = q8Functions,
        Endpoints = new Dictionary<string, string> { ["catalog"] = "in-process://catalog" },
        ChoiceFetcher = (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            q8ChoiceRequest = request;
            return System.Threading.Tasks.ValueTask.FromResult(KajayValue.FromArray([KajayValue.FromObject([new("code", KajayValue.From("gb")), new("title", KajayValue.From("United Kingdom"))])]));
        },
        FileUploader = (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            SurveyFileEntry file = request.Files.Single();
            return System.Threading.Tasks.ValueTask.FromResult<IReadOnlyList<SurveyFileEntry>>([file with { Content = null, Url = $"stored://{file.Name}" }]);
        },
        FileDownloader = async (request, cancellationToken) =>
        {
            if (q8BlockDownload)
            {
                q8DownloadStarted.SetResult();
                await System.Threading.Tasks.Task.Delay(System.Threading.Timeout.InfiniteTimeSpan, cancellationToken);
            }
            return $"signed://{request.File.Name}";
        },
        FileCleaner = (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            q8Cleaned.AddRange(request.Files.Select(file => file.Name));
            return System.Threading.Tasks.ValueTask.CompletedTask;
        },
    });
await q8Survey.SetValueAsync("region", KajayValue.From("north west"));
SurveyChoiceQuestion q8Country = (SurveyChoiceQuestion)q8Survey.GetQuestion("country")!;
SurveyFileQuestion q8Receipt = (SurveyFileQuestion)q8Survey.GetQuestion("receipt")!;
await q8Receipt.AttachAsync([new SurveyFileEntry("receipt.pdf", "application/pdf", 4, "inline")]);
string q8Url = await q8Receipt.ResolveUrlAsync(q8Receipt.Files.Single());
await q8Receipt.RemoveAsync("receipt.pdf");
if (q8ChoiceRequest?.Url != "in-process://catalog/north%20west"
    || q8Country.Choices.Single() != KajayValue.From("gb")
    || !q8Survey.IsPageVisible("branch")
    || q8Url != "signed://receipt.pdf"
    || !q8Cleaned.SequenceEqual(["receipt.pdf"]))
{
    throw new InvalidOperationException("Installed package failed Q8 host I/O parity.");
}
q8BlockDownload = true;
using var q8Cancellation = new System.Threading.CancellationTokenSource();
System.Threading.Tasks.Task<string> q8PendingDownload = q8Receipt.ResolveUrlAsync(
    new SurveyFileEntry("receipt.pdf", "application/pdf", 4),
    q8Cancellation.Token);
await q8DownloadStarted.Task;
q8Cancellation.Cancel();
try { await q8PendingDownload; throw new InvalidOperationException("Installed package ignored host I/O cancellation."); }
catch (OperationCanceledException) { }
