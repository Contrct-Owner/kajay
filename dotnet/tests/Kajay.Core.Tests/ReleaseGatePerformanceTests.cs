using System.Diagnostics;
using Xunit.Abstractions;

namespace Kajay.Core.Tests;

[Collection(ReleasePerformanceGroup.Name)]
public sealed class ReleaseGatePerformanceTests
{
    private const int SampleCount = 20;
    private readonly ITestOutputHelper _output;

    public ReleaseGatePerformanceTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact(DisplayName = "parity/Q10-release-gates")]
    public async Task SupportedScaleAndIndependentInstancesMeetReleaseGates()
    {
        foreach (SurveyScale scale in new[] { SurveyScale.Standard, SurveyScale.Stress })
        {
            AssertScale(scale);
        }

        await AssertIndependentInstances().ConfigureAwait(true);
    }

    private void AssertScale(SurveyScale scale)
    {
        string json = SurveyScaleWorkload.CreateDefinition(scale);
        _ = SurveyDefinition.Parse(json).Definition.CreateSurvey();
        PerformanceSample definitionParse = P95(() => SurveyDefinition.Parse(json).Definition);
        SurveyDefinition parsedDefinition = SurveyDefinition.Parse(json).Definition;
        PerformanceSample construction = P95(parsedDefinition.CreateSurvey);
        WriteSample(scale.Name, "definition parse", definitionParse);
        WriteSample(scale.Name, "survey construction", construction);
        PerformanceSample parse = P95(() =>
            SurveyDefinition.Parse(json).Definition.CreateSurvey());
        AssertWithin(scale.Name, "parse", parse, scale.ParseTarget, scale.AllocationTarget);

        SurveyDefinition definition = SurveyDefinition.Parse(json).Definition;
        Survey survey = definition.CreateSurvey();
        SurveyScaleWorkload.MaterializeAnswers(survey, scale);
        bool toggle = false;
        PerformanceSample answer = P95(() =>
        {
            toggle = !toggle;
            survey.SetValue("q0", KajayValue.From(toggle ? "yes" : "no"));
            return survey;
        });
        AssertWithin(scale.Name, "answer", answer, scale.AnswerTarget, long.MaxValue);

        PerformanceSample validation = P95(() => survey.Validation.ValidateCurrentPage());
        AssertWithin(
            scale.Name,
            "validation",
            validation,
            scale.ValidationTarget,
            long.MaxValue);
        PerformanceSample serialization = P95(definition.ToCanonicalJson);
        AssertWithin(
            scale.Name,
            "serialization",
            serialization,
            scale.SerializationTarget,
            long.MaxValue);
        long retained = RetainedBytes(definition);
        _output.WriteLine($"{scale.Name} retained: {retained:N0} bytes");
        Assert.True(retained <= scale.RetainedByteTarget);
    }

    private static async Task AssertIndependentInstances()
    {
        SurveyDefinition definition = SurveyDefinition.Parse(
            SurveyScaleWorkload.CreateDefinition(SurveyScale.Standard)).Definition;
        Task<KajayValue>[] tasks = Enumerable.Range(0, 32).Select(index => Task.Run(() =>
        {
            Survey survey = definition.CreateSurvey();
            KajayValue answer = KajayValue.From(index);
            survey.SetValue("q0", answer);
            return survey.GetQuestion("q0")!.Value;
        })).ToArray();

        KajayValue[] answers = await Task.WhenAll(tasks).ConfigureAwait(false);
        Assert.Equal(Enumerable.Range(0, 32).Select(index => KajayValue.From(index)), answers);
    }

    private static PerformanceSample P95(Func<object> operation)
    {
        PerformanceSample[] samples = Enumerable.Range(0, SampleCount)
            .Select(_ => Measure(operation))
            .ToArray();
        int index = (int)Math.Ceiling(samples.Length * 0.95) - 1;
        return new PerformanceSample(
            samples.OrderBy(sample => sample.Elapsed).ElementAt(index).Elapsed,
            samples.OrderBy(sample => sample.AllocatedBytes).ElementAt(index).AllocatedBytes);
    }

    private static PerformanceSample Measure(Func<object> operation)
    {
        long allocatedBefore = GC.GetAllocatedBytesForCurrentThread();
        long started = Stopwatch.GetTimestamp();
        object result = operation();
        TimeSpan elapsed = Stopwatch.GetElapsedTime(started);
        long allocated = GC.GetAllocatedBytesForCurrentThread() - allocatedBefore;
        GC.KeepAlive(result);
        return new PerformanceSample(elapsed, allocated);
    }

    private static long RetainedBytes(SurveyDefinition definition)
    {
        long before = GC.GetTotalMemory(forceFullCollection: true);
        Survey survey = definition.CreateSurvey();
        long retained = Math.Max(0, GC.GetTotalMemory(forceFullCollection: true) - before);
        GC.KeepAlive(survey);
        return retained;
    }

    private void AssertWithin(
        string scale,
        string operation,
        PerformanceSample sample,
        TimeSpan elapsedTarget,
        long allocationTarget)
    {
        WriteSample(scale, operation, sample);
        if (Environment.GetEnvironmentVariable("KAJAY_ENFORCE_PERFORMANCE_TARGETS") == "1")
        {
            Assert.True(
                sample.Elapsed <= elapsedTarget,
                $"{scale} {operation} p95 was {sample.Elapsed.TotalMilliseconds:F2} ms; "
                    + $"target is {elapsedTarget.TotalMilliseconds:F2} ms.");
        }
        Assert.True(
            sample.AllocatedBytes <= allocationTarget,
            $"{scale} {operation} p95 allocated {sample.AllocatedBytes:N0} bytes; "
                    + $"target is {allocationTarget:N0} bytes.");
    }

    private void WriteSample(string scale, string operation, PerformanceSample sample)
    {
        _output.WriteLine(
            $"{scale} {operation}: {sample.Elapsed.TotalMilliseconds:F2} ms p95, "
                + $"{sample.AllocatedBytes:N0} bytes p95 allocated");
    }

    private sealed record PerformanceSample(TimeSpan Elapsed, long AllocatedBytes);
}
