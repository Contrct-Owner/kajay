namespace Kajay.Core.Tests;

public sealed class SurveyQuestionModelsParityTests
{
    [Fact(DisplayName = "parity/Q7-question-models")]
    public void PublicQuestionModelsOwnScalarChoiceAndCompositeAnswerShapes()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"one","elements":[
              {"type":"text","name":"alias","valueName":"shared"},
              {"type":"checkbox","name":"choices","choices":[1,2,3]},
              {"type":"matrix","name":"matrix","isAllRowRequired":true,"rows":["a","b"],"columns":[1,2]},
              {"type":"matrixcells","name":"cells","rows":["a","b"],"columns":[{"type":"text","name":"item","isRequired":true}]},
              {"type":"matrixdynamic","name":"rows","minRowCount":1,"maxRowCount":2,"columns":[{"type":"text","name":"item","isRequired":true}]},
              {"type":"paneldynamic","name":"people","minPanelCount":1,"maxPanelCount":2,"templateElements":[{"type":"text","name":"age","isRequired":true},{"type":"text","name":"guardian","requiredIf":"{panel.age} < 18"}]},
              {"type":"file","name":"files","allowMultiple":true,"storeDataAsText":true,"acceptedTypes":".pdf"},
              {"type":"signaturepad","name":"signature","signatureFormat":"svg"}
            ]}]}
            """)
            .Definition
            .CreateSurvey();

        SurveyQuestion scalar = Assert.IsType<SurveyScalarQuestion>(survey.GetQuestion("alias"));
        scalar.SetValue(KajayValue.From("shared answer"));
        Assert.Equal(KajayValue.From("shared answer"), survey.Data["shared"]);

        SurveyChoiceQuestion choices = Assert.IsType<SurveyChoiceQuestion>(
            survey.GetQuestion("choices"));
        choices.SetSelection([KajayValue.From("2"), KajayValue.From(1), KajayValue.From(2)]);
        Assert.Equal([KajayValue.From(2), KajayValue.From(1)], choices.Value.GetArray());

        SurveyMatrixQuestion matrix = Assert.IsType<SurveyMatrixQuestion>(
            survey.GetQuestion("matrix"));
        matrix.SetRowValue(KajayValue.From("a"), KajayValue.From(1));

        SurveyMatrixQuestion cells = Assert.IsType<SurveyMatrixQuestion>(
            survey.GetQuestion("cells"));
        cells.SetCellValue(KajayValue.From("a"), "item", KajayValue.From("first"));
        cells.SetCellValue(KajayValue.From("b"), "item", KajayValue.From("second"));
        Assert.Equal(KajayValue.From("second"),
            cells.GetCellValue(KajayValue.From("b"), "item"));

        SurveyRecordQuestion rows = Assert.IsType<SurveyRecordQuestion>(survey.GetQuestion("rows"));
        rows.SetField(0, "item", KajayValue.From("Pens"));
        Assert.True(rows.Add());
        Assert.Equal(2, rows.Value.GetArray().Count);

        SurveyRecordQuestion people = Assert.IsType<SurveyRecordQuestion>(
            survey.GetQuestion("people"));
        people.SetField(0, "age", KajayValue.From(12));

        SurveyFileQuestion files = Assert.IsType<SurveyFileQuestion>(survey.GetQuestion("files"));
        files.Attach(
        [
            new SurveyFileEntry(
                "receipt.pdf",
                "application/pdf",
                4,
                "data:application/pdf;base64,AAAA"),
        ]);
        Assert.Equal("receipt.pdf", Assert.Single(files.Files).Name);

        SurveySignatureQuestion signature = Assert.IsType<SurveySignatureQuestion>(
            survey.GetQuestion("signature"));
        signature.Sign("data:image/svg+xml;base64,AAAA");
        Assert.Equal(SurveySignatureFormat.Svg, signature.Format);

        SurveyValidationResult validation = survey.Validation.ValidateCurrentPage();
        Assert.Equal(
            [("matrix", "b"), ("rows", "1.item"), ("people", "0.guardian")],
            validation.Errors.Select(error => (error.Name, error.Path)));
        Assert.Equal(
            ["shared", "choices", "matrix", "cells", "rows", "people", "files", "signature"],
            survey.Data.Keys);
    }
}
