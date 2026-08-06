namespace Kajay.Core.Tests;

public sealed class SurveyCompositeQuestionTests
{
    [Fact]
    public void StaticMatrixStoresOneObjectAndClearsItsLastRow()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"matrix","name":"comparison","rows":["docs",{"value":"price"}],"columns":[1,2,3]}]}]}""")
            .Definition
            .CreateSurvey();
        SurveyMatrixQuestion matrix = Assert.IsType<SurveyMatrixQuestion>(
            survey.GetQuestion("comparison"));

        matrix.SetRowValue(KajayValue.From("docs"), KajayValue.From(1));
        matrix.SetRowValue(KajayValue.From("price"), KajayValue.From(3));
        Assert.Equal(KajayValue.From(1), matrix.GetRowValue(KajayValue.From("docs")));
        Assert.Equal(2, matrix.Value.GetObject().Count);

        matrix.SetRowValue(KajayValue.From("docs"), KajayValue.Absent);
        matrix.SetRowValue(KajayValue.From("price"), KajayValue.Absent);
        Assert.Equal(KajayValue.Absent, matrix.Value);
        Assert.Throws<ArgumentException>(() =>
            matrix.SetRowValue(KajayValue.From("unknown"), KajayValue.From(1)));
    }

    [Fact]
    public void DynamicMatrixMaterializesMinimumRowsAndCompactsRemoval()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"matrixdynamic","name":"basket","minRowCount":2,"maxRowCount":3,"columns":[{"type":"text","name":"item"}]}]}]}""")
            .Definition
            .CreateSurvey();
        SurveyRecordQuestion matrix = Assert.IsType<SurveyRecordQuestion>(
            survey.GetQuestion("basket"));

        Assert.Equal(2, matrix.Count);
        Assert.Equal(KajayValue.Absent, matrix.Value);
        matrix.SetField(0, "item", KajayValue.From("Pens"));
        Assert.True(matrix.Add());
        matrix.SetField(2, "item", KajayValue.From("Paper"));
        Assert.False(matrix.CanAdd);
        Assert.True(matrix.RemoveAt(0));

        Assert.Equal(2, matrix.Count);
        Assert.Equal(KajayValue.From("Paper"), matrix.Records[1]["item"]);
        Assert.False(matrix.CanRemove);
    }

    [Fact]
    public void NewDynamicMatrixRowCopiesThePreviousRecordBeforeTheFixedDefault()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"matrixdynamic","name":"basket","defaultRowValue":{"quantity":1},"defaultValueFromLastRow":true,"columns":[{"type":"text","name":"quantity"}]}]}]}""")
            .Definition
            .CreateSurvey();
        SurveyRecordQuestion matrix = Assert.IsType<SurveyRecordQuestion>(
            survey.GetQuestion("basket"));

        matrix.SetField(0, "quantity", KajayValue.From(9));
        Assert.True(matrix.Add());
        matrix.SetField(1, "quantity", KajayValue.From(10));

        Assert.Equal(KajayValue.From(9), matrix.Records[0]["quantity"]);
        Assert.Equal(KajayValue.From(10), matrix.Records[1]["quantity"]);
    }

    [Fact]
    public void DynamicPanelUsesAnIndependentDefaultRecordAndHonorsAddPolicy()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"paneldynamic","name":"people","minPanelCount":1,"maxPanelCount":2,"defaultPanelValue":{"country":"US"},"templateElements":[{"type":"text","name":"fullName"}]}]}]}""")
            .Definition
            .CreateSurvey();
        SurveyRecordQuestion panel = Assert.IsType<SurveyRecordQuestion>(survey.GetQuestion("people"));

        panel.SetField(0, "fullName", KajayValue.From("Ada"));
        Assert.True(panel.Add());
        Assert.Equal(KajayValue.From("US"), panel.Records[1]["country"]);
        panel.SetField(1, "country", KajayValue.From("GB"));

        Assert.Equal(KajayValue.From("GB"), panel.Records[1]["country"]);
        Assert.False(panel.Add());
    }

    [Fact]
    public void StaticMatrixValidationNamesMissingAndDuplicateRows()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"matrix","name":"comparison","isRequired":true,"isAllRowRequired":true,"eachRowUnique":true,"rows":["docs","support","price"],"columns":[1,2,3]}]}]}""")
            .Definition
            .CreateSurvey();
        SurveyMatrixQuestion matrix = Assert.IsType<SurveyMatrixQuestion>(
            survey.GetQuestion("comparison"));
        matrix.SetRowValue(KajayValue.From("docs"), KajayValue.From(1));
        matrix.SetRowValue(KajayValue.From("support"), KajayValue.From(1));

        SurveyValidationResult result = survey.Validation.ValidateCurrentPage();

        Assert.Equal(["matrixunique", "required"], result.Errors.Select(error => error.Kind));
        Assert.Equal(["support", "price"], result.Errors.Select(error => error.Path));
    }

    [Fact]
    public void RepeatingValidationUsesEachRecordScopeAndPresentedMinimum()
    {
        Survey survey = SurveyDefinition.Parse(
            """
            {"pages":[{"name":"one","elements":[{
              "type":"paneldynamic","name":"people","minPanelCount":2,
              "templateElements":[
                {"type":"text","name":"age","isRequired":true},
                {"type":"text","name":"guardian","requiredIf":"{panel.age} < 18","visibleIf":"{panel.age} < 18"}
              ]
            }]}]}
            """)
            .Definition
            .CreateSurvey();
        SurveyRecordQuestion panel = Assert.IsType<SurveyRecordQuestion>(survey.GetQuestion("people"));
        panel.SetField(0, "age", KajayValue.From(12));
        panel.SetField(1, "age", KajayValue.From(40));

        SurveyValidationResult result = survey.Validation.ValidateCurrentPage();

        SurveyValidationError error = Assert.Single(result.Errors);
        Assert.Equal("required", error.Kind);
        Assert.Equal("0.guardian", error.Path);
    }

    [Fact]
    public void CompositeMatrixStoresCellsAndValidatesEachAuthoredRowScope()
    {
        Survey survey = SurveyDefinition.Parse(
            """{"pages":[{"name":"one","elements":[{"type":"matrixcells","name":"basket","rows":["docs","support"],"columns":[{"type":"text","name":"item","isRequired":true},{"type":"text","name":"reason","requiredIf":"{row.item} = 'urgent'"}]}]}]}""")
            .Definition
            .CreateSurvey();
        SurveyMatrixQuestion matrix = Assert.IsType<SurveyMatrixQuestion>(
            survey.GetQuestion("basket"));
        matrix.SetCellValue(KajayValue.From("docs"), "item", KajayValue.From("urgent"));

        Assert.Equal(
            KajayValue.From("urgent"),
            matrix.GetCellValue(KajayValue.From("docs"), "item"));
        SurveyValidationResult result = survey.Validation.ValidateCurrentPage();
        Assert.Equal(["docs.reason", "support.item"], result.Errors.Select(error => error.Path));

        matrix.SetCellValue(KajayValue.From("docs"), "item", KajayValue.Absent);
        Assert.Equal(KajayValue.Absent, matrix.GetRowValue(KajayValue.From("docs")));
    }
}
