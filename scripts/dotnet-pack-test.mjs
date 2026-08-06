#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const repositoryRoot = resolve(import.meta.dirname, '..');
const project = resolve(repositoryRoot, 'dotnet/src/Kajay.Core/Kajay.Core.csproj');
const questionModelSmoke = readFileSync(resolve(repositoryRoot, 'scripts/dotnet-pack-question-model-smoke.cs'), 'utf8');
const consumerProgram = `using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Kajay;
if (KajayContracts.SurveySchemaId != "urn:kajay:survey-definition:1"
    || KajayContracts.CurrentSurveySchemaVersion != 1
    || KajayContracts.RuntimeMetadataContractVersion != 1
    || KajayContracts.RuntimeDiagnosticsContractVersion != 1
    || !KajayContracts.SupportedSurveySchemaVersions.SequenceEqual([1])
    || !KajayContracts.SupportedConformanceVersions.SequenceEqual([1, 2]))
{
    throw new InvalidOperationException("Installed package exposed the wrong contract versions.");
}

string[] resources = typeof(KajayContracts).Assembly.GetManifestResourceNames();
if (!resources.Order(StringComparer.Ordinal).SequenceEqual(new[]
    {
        "Kajay.Core.Contracts.runtime-diagnostics.json",
        "Kajay.Core.Contracts.runtime-metadata.json",
        "Kajay.Core.Contracts.survey-schema.json",
    }))
{
    throw new InvalidOperationException("Installed package exposed unexpected runtime resources.");
}

using Stream stream = KajayContracts.OpenSurveySchema();
using JsonDocument schema = JsonDocument.Parse(stream);
if (schema.RootElement.GetProperty("$id").GetString() != KajayContracts.SurveySchemaId)
{
    throw new InvalidOperationException("Installed package exposed the wrong survey contract.");
}

const string definition = """{"description":"Registry driven","pages":[{"name":"p1","colCount":2,"elements":[{"type":"text","name":"q1","placeholder":"Answer","correctAnswer":"42","extension":{"keep":true}}]}]}""";
const string expected = """{"schemaVersion":1,"description":"Registry driven","pages":[{"name":"p1","colCount":2,"elements":[{"type":"text","name":"q1","correctAnswer":"42","placeholder":"Answer","extension":{"keep":true}}]}]}""";
SurveyDefinitionParseResult parsed = SurveyDefinition.Parse(definition);
if (parsed.Diagnostics.Count != 1
    || parsed.Diagnostics[0].Code != "unknown-property"
    || parsed.Diagnostics[0].Path != "/pages/0/elements/0/extension"
    || parsed.Definition.ToCanonicalJson() != expected
    || SurveyDefinition.Parse(expected).Definition.ToCanonicalJson() != expected)
{
    throw new InvalidOperationException("Installed package failed definition canonicalization.");
}

try
{
    SurveyDefinition.Parse("""{"schemaVersion":2}""");
    throw new InvalidOperationException("Installed package accepted an unsupported schema.");
}
catch (UnsupportedSurveySchemaVersionException exception) when (exception.DeclaredVersion == 2)
{
}

ExpressionParseResult expression = SurveyExpression.Parse("{a} = 1 && {b} <> 2");
if (expression.Errors.Count != 0
    || expression.Expression?.ToCanonicalString() != "{a} == 1 and {b} != 2")
{
    throw new InvalidOperationException("Installed package failed expression canonicalization.");
}

ExpressionParseResult arithmetic = SurveyExpression.Parse("1 + 2 * 3");
ExpressionEvaluationResult evaluated = arithmetic.Expression!.Evaluate(
    new ExpressionEvaluationContext(DateTimeOffset.UnixEpoch));
if (arithmetic.Errors.Count != 0
    || evaluated.Errors.Count != 0
    || evaluated.Value.Kind != KajayValueKind.Number
    || evaluated.Value.GetNumber() != 7)
{
    throw new InvalidOperationException("Installed package failed expression evaluation.");
}

ExpressionParseResult nested = SurveyExpression.Parse(
    "{panel[1].question} + {panel[1].question} + {other}");
KajayValue panel = KajayValue.FromArray(
[
    KajayValue.FromObject([]),
    KajayValue.FromObject(
    [
        new KeyValuePair<string, KajayValue>("question", KajayValue.From(40)),
    ]),
]);
ExpressionEvaluationResult nestedValue = nested.Expression!.Evaluate(
    new ExpressionEvaluationContext(
        DateTimeOffset.UnixEpoch,
        [
            new KeyValuePair<string, KajayValue>("panel", panel),
            new KeyValuePair<string, KajayValue>("other", KajayValue.From(2)),
        ]));
if (nested.Errors.Count != 0
    || !nested.Expression.ReferencedValuePaths.SequenceEqual(["panel[1].question", "other"])
    || nestedValue.Value != KajayValue.From(82))
{
    throw new InvalidOperationException("Installed package failed structured references.");
}

Survey survey = parsed.Definition.CreateSurvey();
QuizScore emptyScore = survey.GetQuizScore();
survey.SetValue("q1", KajayValue.From("42"));
QuizScore answeredScore = survey.GetQuizScore();
if (emptyScore.Earned != 0
    || emptyScore.Possible != 1
    || answeredScore.Earned != 1
    || answeredScore.Ratio != 1)
{
    throw new InvalidOperationException("Installed package failed quiz scoring.");
}

Survey navigation = SurveyDefinition.Parse(
    """{"pages":[{"name":"first"},{"name":"second"}]}""")
    .Definition
    .CreateSurvey();
int pageChanges = 0;
navigation.CurrentPageChanged += (_, change) =>
{
    bool expected = pageChanges == 0
        ? change.PreviousPageIndex == 0 && change.CurrentPageIndex == 1
        : change.PreviousPageIndex == 1 && change.CurrentPageIndex == 0;
    if (!expected)
    {
        throw new InvalidOperationException("Installed package emitted the wrong page change.");
    }
    pageChanges += 1;
};
SurveyAdvanceOutcome advance = navigation.AdvanceAsync().GetAwaiter().GetResult();
SurveyPageProgress advancedProgress = navigation.PageProgress;
bool movedBack = navigation.MovePrevious();
if (advance != SurveyAdvanceOutcome.Advanced
    || advancedProgress != new SurveyPageProgress(2, 2, 1)
    || !movedBack
    || pageChanges != 2
    || navigation.CurrentPageName != "first")
{
    throw new InvalidOperationException("Installed package failed survey navigation.");
}

Survey calculated = SurveyDefinition.Parse(
    """{"calculatedValues":[{"name":"subtotal","expression":"{price} * 2"},{"name":"total","expression":"{subtotal} + 5","includeIntoResult":true}],"pages":[{"name":"one"}]}""")
    .Definition
    .CreateSurvey();
calculated.SetValue("price", KajayValue.From(20));
if (!calculated.TryGetCalculatedValue("subtotal", out KajayValue subtotal)
    || subtotal != KajayValue.From(40)
    || !calculated.TryGetValue("total", out KajayValue total)
    || total != KajayValue.From(45)
    || calculated.Data["total"] != KajayValue.From(45)
    || calculated.Data.ContainsKey("subtotal"))
{
    throw new InvalidOperationException("Installed package failed calculated values.");
}

Survey triggered = SurveyDefinition.Parse(
    """{"triggers":[{"type":"setvalue","expression":"{start} = true","setToName":"result","setValue":42}],"pages":[{"name":"one"}]}""")
    .Definition
    .CreateSurvey();
SurveyCompletedEventArgs? triggeredCompletion = null;
triggered.Completed += (_, completion) => triggeredCompletion = completion;
triggered.SetValue("start", KajayValue.From(true));
triggered.Timer.Start();
if (!triggered.TryGetValue("result", out KajayValue triggeredResult)
    || triggeredResult != KajayValue.From(42)
    || !triggered.Timer.IsRunning)
{
    throw new InvalidOperationException("Installed package failed trigger settlement.");
}
triggered.Complete();
if (!triggered.IsCompleted
    || triggered.Timer.IsRunning
    || triggeredCompletion?.Data["result"] != KajayValue.From(42))
{
    throw new InvalidOperationException("Installed package failed lifecycle completion.");
}

Survey conditional = SurveyDefinition.Parse(
    """{"pages":[{"name":"start"},{"name":"branch","visibleIf":"{show} = true","elements":[{"type":"text","name":"answer","enableIf":"{edit} = true"}]}]}""")
    .Definition
    .CreateSurvey();
conditional.SetValue("show", KajayValue.From(true));
conditional.SetValue("edit", KajayValue.From(true));
if (conditional.PageCount != 2
    || !conditional.IsPageVisible("branch")
    || !conditional.TryGetQuestionState("answer", out SurveyQuestionState answerState)
    || answerState != new SurveyQuestionState(true, true, false, true))
{
    throw new InvalidOperationException("Installed package failed conditional state.");
}
List<string> validationCalls = [];
bool rejectServer = true;
Survey validation = SurveyDefinition.Parse(
    """{"checkErrorsMode":"onValueChanged","pages":[{"name":"one","elements":[{"type":"text","name":"answer","isRequired":true,"validators":[{"type":"textvalidator","minLength":3}]},{"type":"text","name":"expression","validators":[{"type":"expressionvalidator","expression":"{agreed} = true"}]},{"type":"text","name":"custom"}]},{"name":"two"}]}""")
    .Definition
    .CreateSurvey(new SurveyOptions
    {
        QuestionValidator = context => { validationCalls.Add($"sync:{context.Name}"); return context.Name == "custom" && context.Value == KajayValue.From("reject") ? [new SurveyValidationError("custom", "custom")] : []; },
        AsyncQuestionValidator = (context, _) => { validationCalls.Add($"async:{context.Name}"); return System.Threading.Tasks.ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>([]); },
        ServerValidator = (context, _) => { validationCalls.Add($"server:{string.Join(',', context.QuestionNames)}"); return System.Threading.Tasks.ValueTask.FromResult<IReadOnlyList<SurveyValidationError>>(rejectServer ? [new SurveyValidationError("answer", "server", "Rejected")] : []); },
    });
validation.SetValue("answer", KajayValue.From("no"));
validation.SetValue("custom", KajayValue.From("reject"));
if (validation.Validation.Mode != SurveyValidationMode.OnValueChanged || validation.Validation.GetErrors("answer").Single().Kind != "textvalidator" || validation.Validation.GetErrors("custom").Single().Kind != "custom") throw new InvalidOperationException("Installed package failed on-change validation state.");
validation.SetValue("answer", KajayValue.From("valid"));
validation.SetValue("custom", KajayValue.From("accepted"));
validation.SetValue("expression", KajayValue.From("answered"));
validation.SetValue("agreed", KajayValue.From(true));
SurveyAdvanceOutcome remotelyBlocked = await validation.AdvanceAsync();
if (remotelyBlocked != SurveyAdvanceOutcome.Blocked || validation.Validation.Errors.Single().Kind != "server" || !validationCalls.Contains("async:answer") || !validationCalls.Contains("async:expression") || !validationCalls.Contains("server:answer,expression,custom")) throw new InvalidOperationException("Installed package failed host/server validation.");
rejectServer = false;
if (await validation.AdvanceAsync() != SurveyAdvanceOutcome.Advanced || validation.CurrentPageName != "two" || validation.Validation.Errors.Count != 0) throw new InvalidOperationException("Installed package failed awaitable validated navigation.");
Survey cancellable = SurveyDefinition.Parse(
    """{"pages":[{"name":"one","elements":[{"type":"text","name":"answer"}]},{"name":"two"}]}""")
    .Definition
    .CreateSurvey(new SurveyOptions
    {
        AsyncQuestionValidator = async (_, cancellationToken) => { await System.Threading.Tasks.Task.Delay(System.Threading.Timeout.InfiniteTimeSpan, cancellationToken); return []; },
    });
cancellable.SetValue("answer", KajayValue.From("value"));
using var cancellation = new System.Threading.CancellationTokenSource();
System.Threading.Tasks.Task<SurveyAdvanceOutcome> pendingValidation = cancellable.AdvanceAsync(cancellation.Token);
cancellation.Cancel();
try { await pendingValidation; throw new InvalidOperationException("Installed package ignored validation cancellation."); }
catch (OperationCanceledException) { }
if (cancellable.Validation.IsValidating || cancellable.CurrentPageName != "one") throw new InvalidOperationException("Installed package failed cancellation cleanup.");
${questionModelSmoke}
Console.WriteLine("dotnet pack smoke: ok");
`;
const scratch = mkdtempSync(join(tmpdir(), 'kajay-dotnet-pack-'));
const packageDirectory = join(scratch, 'packages');
const consumerDirectory = join(scratch, 'consumer');

try {
  mkdirSync(packageDirectory);
  mkdirSync(consumerDirectory);
  run('dotnet', [
    'pack',
    project,
    '--configuration',
    'Release',
    '--no-restore',
    '--output',
    packageDirectory,
  ]);
  const packageFile = readdirSync(packageDirectory).find(
    (file) => file.startsWith('Kajay.Core.') && file.endsWith('.nupkg'),
  );
  if (packageFile === undefined) throw new Error('Kajay.Core pack produced no .nupkg.');

  const packageVersion = packageFile.slice('Kajay.Core.'.length, -'.nupkg'.length);
  const consumerProjectPath = join(consumerDirectory, 'Consumer.csproj');
  writeFileSync(consumerProjectPath, consumerProject(packageVersion));
  writeFileSync(join(consumerDirectory, 'Program.cs'), consumerProgram);
  run('dotnet', [
    'restore',
    consumerProjectPath,
    '--source',
    packageDirectory,
    '--ignore-failed-sources',
  ]);
  run('dotnet', [
    'run',
    '--project',
    consumerProjectPath,
    '--configuration',
    'Release',
    '--no-restore',
  ]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, NUGET_PACKAGES: join(scratch, 'nuget-packages') },
    stdio: 'inherit',
  });
}

function consumerProject(packageVersion) {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Kajay.Core" Version="${packageVersion}" />
  </ItemGroup>
</Project>
`;
}
