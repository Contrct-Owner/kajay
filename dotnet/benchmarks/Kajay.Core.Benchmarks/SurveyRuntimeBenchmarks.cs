using BenchmarkDotNet.Attributes;

namespace Kajay.Core.Benchmarks;

[MemoryDiagnoser]
public class SurveyRuntimeBenchmarks
{
    private string _definitionJson = null!;
    private SurveyDefinition _definition = null!;

    [Params(250, 1_000)]
    public int QuestionCount { get; set; }

    [GlobalSetup]
    public void Setup()
    {
        _definitionJson = SurveyRuntimeWorkload.CreateDefinition(
            QuestionCount,
            QuestionCount * 4);
        _definition = SurveyDefinition.Parse(_definitionJson).Definition;
    }

    [Benchmark]
    public SurveyDefinition ParseDefinition()
    {
        return SurveyDefinition.Parse(_definitionJson).Definition;
    }

    [Benchmark]
    public Survey CreateSurvey()
    {
        return _definition.CreateSurvey();
    }

    [Benchmark]
    public IReadOnlyDictionary<string, KajayValue> AnswerAndSerialize()
    {
        Survey survey = _definition.CreateSurvey();
        SurveyRuntimeWorkload.MaterializeAnswers(survey);
        return survey.Data;
    }
}
