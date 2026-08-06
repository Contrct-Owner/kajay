Survey q7Survey = SurveyDefinition.Parse(
    """{"pages":[{"name":"one","elements":[{"type":"checkbox","name":"choices","choices":[1,2,3]},{"type":"matrix","name":"matrix","isAllRowRequired":true,"rows":["a","b"],"columns":[1,2]},{"type":"matrixcells","name":"cells","rows":["a"],"columns":[{"type":"text","name":"item","isRequired":true}]},{"type":"paneldynamic","name":"people","minPanelCount":1,"maxPanelCount":2,"templateElements":[{"type":"text","name":"age","isRequired":true},{"type":"text","name":"guardian","requiredIf":"{panel.age} < 18"}]},{"type":"file","name":"files","storeDataAsText":true},{"type":"signaturepad","name":"signature","signatureFormat":"svg"}]}]}""")
    .Definition
    .CreateSurvey();
SurveyChoiceQuestion q7Choices = (SurveyChoiceQuestion)q7Survey.GetQuestion("choices")!;
q7Choices.SetSelection([KajayValue.From("2"), KajayValue.From(1), KajayValue.From(2)]);
SurveyMatrixQuestion q7Matrix = (SurveyMatrixQuestion)q7Survey.GetQuestion("matrix")!;
q7Matrix.SetRowValue(KajayValue.From("a"), KajayValue.From(1));
SurveyMatrixQuestion q7Cells = (SurveyMatrixQuestion)q7Survey.GetQuestion("cells")!;
q7Cells.SetCellValue(KajayValue.From("a"), "item", KajayValue.From("Pens"));
SurveyRecordQuestion q7People = (SurveyRecordQuestion)q7Survey.GetQuestion("people")!;
q7People.SetField(0, "age", KajayValue.From(12));
SurveyFileQuestion q7Files = (SurveyFileQuestion)q7Survey.GetQuestion("files")!;
q7Files.Attach([new SurveyFileEntry("receipt.pdf", "application/pdf", 4, "data:application/pdf;base64,AAAA")]);
SurveySignatureQuestion q7Signature = (SurveySignatureQuestion)q7Survey.GetQuestion("signature")!;
q7Signature.Sign("data:image/svg+xml;base64,AAAA");
SurveyValidationResult q7Validation = q7Survey.Validation.ValidateCurrentPage();
if (!q7Choices.Value.GetArray().SequenceEqual([KajayValue.From(2), KajayValue.From(1)])
    || q7Matrix.Value.GetObject()["a"] != KajayValue.From(1)
    || q7Cells.GetCellValue(KajayValue.From("a"), "item") != KajayValue.From("Pens")
    || q7People.Value.GetArray()[0].GetObject()["age"] != KajayValue.From(12)
    || q7Files.Files.Single().Content != "data:application/pdf;base64,AAAA"
    || q7Signature.Format != SurveySignatureFormat.Svg
    || !q7Validation.Errors.Select(error => error.Path).SequenceEqual(["b", "0.guardian"]))
{
    throw new InvalidOperationException("Installed package failed Q7 question-model parity.");
}
