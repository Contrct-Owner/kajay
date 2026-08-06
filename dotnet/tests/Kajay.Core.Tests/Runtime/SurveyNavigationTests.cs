namespace Kajay.Core.Tests;

public sealed class SurveyNavigationTests
{
    [Fact]
    public async Task NavigationReportsProgressEventsCompletionAndCancellation()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one"},{"name":"two"},{"name":"three"}]}""")
            .Definition
            .CreateSurvey();
        List<(int Previous, int Current)> pageChanges = [];
        survey.CurrentPageChanged += (_, change) =>
            pageChanges.Add((change.PreviousPageIndex, change.CurrentPageIndex));

        Assert.Equal(3, survey.PageCount);
        Assert.Equal(0, survey.CurrentPageIndex);
        Assert.Equal("one", survey.CurrentPageName);
        Assert.True(survey.IsFirstPage);
        Assert.False(survey.IsLastPage);
        Assert.Equal(new SurveyPageProgress(1, 3, 1d / 3d), survey.PageProgress);

        Assert.True(survey.GoToPage("three"));
        Assert.True(survey.MovePrevious());
        Assert.False(survey.GoToPage("missing"));
        Assert.Equal(
            SurveyAdvanceOutcome.Advanced,
            await survey.AdvanceAsync(CancellationToken.None));
        Assert.Equal("three", survey.CurrentPageName);
        Assert.True(survey.IsLastPage);
        Assert.Equal(new SurveyPageProgress(3, 3, 1), survey.PageProgress);
        Assert.Equal([(0, 2), (2, 1), (1, 2)], pageChanges);

        Assert.Equal(
            SurveyAdvanceOutcome.Advanced,
            await survey.AdvanceAsync(CancellationToken.None));
        Assert.True(survey.IsCompleted);
        Assert.Equal(
            SurveyAdvanceOutcome.NoChange,
            await survey.AdvanceAsync(CancellationToken.None));

        Survey cancellable = SurveyDefinition.Parse("""{"pages":[{"name":"one"}]}""")
            .Definition
            .CreateSurvey();
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAsync<TaskCanceledException>(
            () => cancellable.AdvanceAsync(cancellation.Token));
        Assert.False(cancellable.IsCompleted);
    }

    [Fact]
    public void EmptySurveyHasZeroPageProgress()
    {
        Survey survey = SurveyDefinition.Parse("{}").Definition.CreateSurvey();

        Assert.Equal(new SurveyPageProgress(0, 0, 0), survey.PageProgress);
        Assert.Equal(string.Empty, survey.CurrentPageName);
        Assert.True(survey.IsFirstPage);
        Assert.True(survey.IsLastPage);
        Assert.False(survey.MovePrevious());
    }
}
