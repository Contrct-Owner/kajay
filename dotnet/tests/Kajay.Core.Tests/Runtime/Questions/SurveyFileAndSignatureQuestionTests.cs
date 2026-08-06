namespace Kajay.Core.Tests;

public sealed class SurveyFileAndSignatureQuestionTests
{
    [Fact]
    public void SingleFileResponseIsAlwaysAnArrayAndKeepsTheLatestAttachment()
    {
        (_, SurveyFileQuestion file) = CreateFileQuestion(
            """{"type":"file","name":"receipt","storeDataAsText":true}""");

        file.Attach([Entry("first.pdf")]);
        file.Attach([Entry("better.pdf")]);

        SurveyFileEntry stored = Assert.Single(file.Files);
        Assert.Equal("better.pdf", stored.Name);
        Assert.Equal("data:application/pdf;base64,AAAA", stored.Content);
        Assert.Equal(KajayValueKind.Array, file.Value.Kind);
    }

    [Fact]
    public void MultipleFilesAccumulateDropContentAndClearTheEmptyResponse()
    {
        (_, SurveyFileQuestion file) = CreateFileQuestion(
            """{"type":"file","name":"receipt","allowMultiple":true}""");

        file.Attach([Entry("first.pdf")]);
        file.Attach([Entry("second.pdf")]);
        Assert.Equal(["first.pdf", "second.pdf"], file.Files.Select(entry => entry.Name));
        Assert.All(file.Files, entry => Assert.Null(entry.Content));

        file.Remove("first.pdf");
        Assert.Equal("second.pdf", Assert.Single(file.Files).Name);
        file.ClearFiles();
        Assert.Equal(KajayValue.Absent, file.Value);
    }

    [Fact]
    public void FileRulesReportCountTypeAndSizeWithDescriptorPaths()
    {
        (Survey survey, SurveyFileQuestion file) = CreateFileQuestion(
            """{"type":"file","name":"receipt","allowMultiple":true,"acceptedTypes":"image/*,.pdf","maxSize":1024,"maxFileCount":1}""");
        file.Attach(
        [
            Entry("notes.txt", mediaType: "text/plain", size: 2048),
            Entry("scan.PDF", mediaType: string.Empty),
        ]);

        SurveyValidationResult result = survey.Validation.ValidateCurrentPage();

        Assert.Equal(["filetoomany", "filewrongtype", "filetoolarge"],
            result.Errors.Select(error => error.Kind));
        Assert.Equal([string.Empty, "notes.txt", "notes.txt"],
            result.Errors.Select(error => error.Path));
    }

    [Fact]
    public void SignatureExposesDefinitionSettingsAndEmptyInputClearsTheAnswer()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"signaturepad","name":"sign","penColor":"#ff0000","backgroundColor":"#eeeeee","signatureFormat":"jpeg","signatureWidth":500,"signatureHeight":200,"isRequired":true}]}]}""")
            .Definition
            .CreateSurvey();
        SurveySignatureQuestion signature = Assert.IsType<SurveySignatureQuestion>(
            survey.GetQuestion("sign"));

        Assert.Equal("#ff0000", signature.PenColor);
        Assert.Equal("#eeeeee", signature.BackgroundColor);
        Assert.Equal(SurveySignatureFormat.Jpeg, signature.Format);
        Assert.Equal((500, 200), (signature.Width, signature.Height));
        signature.Sign("data:image/jpeg;base64,AAAA");
        Assert.Equal("data:image/jpeg;base64,AAAA", signature.Signature);
        signature.Sign(string.Empty);

        Assert.Equal(KajayValue.Absent, signature.Value);
        Assert.Equal("required", Assert.Single(survey.Validation.ValidateCurrentPage().Errors).Kind);
    }

    private static SurveyFileEntry Entry(
        string name,
        string mediaType = "application/pdf",
        long size = 512)
    {
        return new SurveyFileEntry(
            name,
            mediaType,
            size,
            "data:application/pdf;base64,AAAA");
    }

    private static (Survey Survey, SurveyFileQuestion Question) CreateFileQuestion(string element)
    {
        Survey survey = SurveyDefinition.Parse(
            $$"""{"pages":[{"name":"one","elements":[{{element}}]}]}""")
            .Definition
            .CreateSurvey();
        return (survey, Assert.IsType<SurveyFileQuestion>(survey.GetQuestion("receipt")));
    }
}
