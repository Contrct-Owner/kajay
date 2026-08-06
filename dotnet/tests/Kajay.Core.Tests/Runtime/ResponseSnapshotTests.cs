namespace Kajay.Core.Tests;

public sealed class ResponseSnapshotTests
{
    private const string DefinitionJson =
        """{"pages":[{"name":"start","elements":[{"type":"text","name":"when"}]},{"name":"details","elements":[{"type":"text","name":"note"}]}]}""";

    [Fact(DisplayName = "parity/E6-portable-response-snapshot")]
    public async Task InstantSurvivesJsonStorageWithoutBecomingText()
    {
        SurveyDefinition definition = SurveyDefinition.Parse(DefinitionJson).Definition;
        Survey source = definition.CreateSurvey();
        DateTimeOffset instant = new(2030, 4, 5, 6, 7, 8, 9, TimeSpan.Zero);
        source.SetValue("when", KajayValue.From(instant));
        Assert.Equal(SurveyAdvanceOutcome.Advanced, await source.AdvanceAsync());

        string stored = source.CreateSnapshot().ToJson();
        Survey restored = definition.CreateSurvey();
        restored.RestoreSnapshot(SurveySnapshot.Parse(stored));

        Assert.Matches("^sha256:[0-9a-f]{64}$", definition.DefinitionDigest);
        Assert.Equal("details", restored.CurrentPageName);
        Assert.True(restored.TryGetValue("when", out KajayValue value));
        Assert.Equal(instant, value.GetInstant());
    }

    [Fact]
    public void DefinitionIdentityIsPortableForUnicodeAndLargeNumbers()
    {
        const string definitionJson =
            """{"schemaVersion":1,"title":"Café ☕","pages":[{"name":"start","elements":[{"type":"text","name":"amount","maxLength":100000000000000000000}]}]}""";

        SurveyDefinition definition = SurveyDefinition.Parse(definitionJson).Definition;

        Assert.Equal(definitionJson, definition.ToCanonicalJson());
        Assert.Equal(
            "sha256:145422a29290589ffa967406f8e75d13d4e6c36e53051e1746513fafb08d384f",
            definition.DefinitionDigest);
    }

    [Theory]
    [InlineData("1e-7", "{\"schemaVersion\":1,\"maxTimeToFinish\":1e-7}", "sha256:3e9b019fbea7d7d171f9f1d574480eeeeb4b599fd1e1d6e7b805a796d4466753")]
    [InlineData("0.000001", "{\"schemaVersion\":1,\"maxTimeToFinish\":0.000001}", "sha256:fc8bc91692cd1ce82823f0c1180e33b4d27e699e54b3b50f1ea1515f35c6fa7c")]
    [InlineData("1e21", "{\"schemaVersion\":1,\"maxTimeToFinish\":1e+21}", "sha256:7db050760f40e19b5d7c766e736512b20d3502a677a600fc886c31ee2b185571")]
    public void DefinitionIdentityUsesPortableNumberSpelling(
        string authoredNumber,
        string canonicalJson,
        string expectedDigest)
    {
        SurveyDefinition definition = SurveyDefinition.Parse(
            $"{{\"maxTimeToFinish\":{authoredNumber}}}").Definition;

        Assert.Equal(canonicalJson, definition.ToCanonicalJson());
        Assert.Equal(expectedDigest, definition.DefinitionDigest);
    }

    [Fact]
    public void DefinitionIdentityUsesJavaScriptJsonStringEscaping()
    {
        const string expected = "{\"schemaVersion\":1,\"title\":\"x\u2028y</script>&\"}";
        SurveyDefinition definition = SurveyDefinition.Parse(expected).Definition;

        Assert.Equal(expected, definition.ToCanonicalJson());
        Assert.Equal(
            "sha256:2df998a780d3b133482163101bc8c91df621ec30936f2fc3a84fbb6439e0f2f5",
            definition.DefinitionDigest);
    }

    [Fact]
    public async Task RestoreReplacesAnswersFallsBackAndDoesNotReplayEvents()
    {
        SurveyDefinition definition = SurveyDefinition.Parse(DefinitionJson).Definition;
        Survey source = definition.CreateSurvey();
        source.SetValue("when", KajayValue.From("stored"));
        source.SetLocale("fr");
        source.EnterPreview();
        string stored = source.CreateSnapshot().ToJson()
            .Replace("\"pageName\":\"start\"", "\"pageName\":\"missing\"", StringComparison.Ordinal);
        Survey restored = definition.CreateSurvey();
        restored.SetValue("old", KajayValue.From("remove me"));
        Assert.Equal(SurveyAdvanceOutcome.Advanced, await restored.AdvanceAsync());
        var events = new List<string>();
        restored.ValueChanged += (_, _) => events.Add("value");
        restored.CurrentPageChanged += (_, _) => events.Add("page");
        restored.LocaleChanged += (_, _) => events.Add("locale");
        restored.StateChanged += (_, _) => events.Add("state");
        restored.Completed += (_, _) => events.Add("complete");

        restored.RestoreSnapshot(SurveySnapshot.Parse(stored));

        Assert.Equal("start", restored.CurrentPageName);
        Assert.Equal("fr", restored.Locale);
        Assert.Equal(SurveyState.Preview, restored.State);
        Assert.False(restored.Data.ContainsKey("old"));
        Assert.Equal(KajayValue.From("stored"), restored.Data["when"]);
        Assert.Empty(events);
    }

    [Fact]
    public void DefinitionMismatchIsRejectedBeforeMutation()
    {
        Survey source = SurveyDefinition.Parse(DefinitionJson).Definition.CreateSurvey();
        source.SetValue("when", KajayValue.From("stored"));
        SurveySnapshot snapshot = SurveySnapshot.Parse(source.CreateSnapshot().ToJson());
        Survey restored = SurveyDefinition.Parse(
            """{"pages":[{"name":"different","elements":[{"type":"text","name":"other"}]}]}""")
            .Definition
            .CreateSurvey();
        restored.SetValue("other", KajayValue.From("unchanged"));

        InvalidOperationException error = Assert.Throws<InvalidOperationException>(
            () => restored.RestoreSnapshot(snapshot));

        Assert.Contains("definition digest", error.Message, StringComparison.Ordinal);
        Assert.Equal(KajayValue.From("unchanged"), restored.Data["other"]);
        Assert.Equal("different", restored.CurrentPageName);
    }

    [Fact]
    public void RunningTimerCountsTimeSpentOutsideTheProcess()
    {
        const string timedDefinition =
            """{"maxTimeToFinish":10,"pages":[{"name":"start","elements":[{"type":"text","name":"when"}]}]}""";
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2030, 4, 5, 6, 0, 0, TimeSpan.Zero));
        SurveyDefinition definition = SurveyDefinition.Parse(timedDefinition).Definition;
        Survey source = definition.CreateSurvey(new SurveyOptions { TimeProvider = clock });
        source.Timer.Start();
        clock.Advance(TimeSpan.FromSeconds(3));
        string stored = source.CreateSnapshot().ToJson();

        clock.Advance(TimeSpan.FromSeconds(8));
        Survey restored = definition.CreateSurvey(new SurveyOptions { TimeProvider = clock });
        restored.RestoreSnapshot(SurveySnapshot.Parse(stored));
        restored.Timer.Tick();

        Assert.True(restored.IsCompleted);
        Assert.False(restored.Timer.IsRunning);
    }

    [Fact]
    public void UnsupportedFormatIsRejectedByTheStorageBoundary()
    {
        string stored = SurveyDefinition.Parse(DefinitionJson).Definition
            .CreateSurvey()
            .CreateSnapshot()
            .ToJson()
            .Replace("\"formatVersion\":1", "\"formatVersion\":2", StringComparison.Ordinal);

        UnsupportedSurveySnapshotVersionException error =
            Assert.Throws<UnsupportedSurveySnapshotVersionException>(
                () => SurveySnapshot.Parse(stored));

        Assert.Equal(2, error.DeclaredVersion);
    }

    [Fact]
    public void AnswersCanRevealThePageNamedByARunningSnapshot()
    {
        SurveyDefinition definition = SurveyDefinition.Parse(
            """{"pages":[{"name":"conditional","visibleIf":"{show} = true"}]}""")
            .Definition;
        Survey source = definition.CreateSurvey();
        source.SetValue("show", KajayValue.From(true));
        Survey restored = definition.CreateSurvey();

        restored.RestoreSnapshot(SurveySnapshot.Parse(source.CreateSnapshot().ToJson()));

        Assert.Equal(SurveyState.Running, restored.State);
        Assert.Equal("conditional", restored.CurrentPageName);
    }

    private sealed class ManualTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return now;
        }

        internal void Advance(TimeSpan duration)
        {
            now += duration;
        }
    }
}
