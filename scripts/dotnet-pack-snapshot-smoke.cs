SurveyDefinition snapshotDefinition = SurveyDefinition.Parse(
    """{"pages":[{"name":"one","elements":[{"type":"text","name":"answer"}]}]}""")
    .Definition;
Survey snapshotSource = snapshotDefinition.CreateSurvey();
snapshotSource.SetValue("answer", KajayValue.From("portable"));
string storedSnapshot = snapshotSource.CreateSnapshot().ToJson();
Survey snapshotRestored = snapshotDefinition.CreateSurvey();
snapshotRestored.RestoreSnapshot(Kajay.Snapshots.SurveySnapshot.Parse(storedSnapshot));
if (snapshotRestored.Data["answer"] != KajayValue.From("portable")
    || !storedSnapshot.Contains(snapshotDefinition.DefinitionDigest, StringComparison.Ordinal))
{
    throw new InvalidOperationException("Installed package failed Response Snapshot storage.");
}
