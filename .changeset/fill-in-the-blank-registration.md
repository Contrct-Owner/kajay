---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Register the `fillintheblank` question type and the blanks it positions. A template is
prose carrying `[[name]]` markers, and a `blanks` collection declares what each name
means — its label, its correct answer, and how it is matched.

The type parses, round-trips, appears in the survey schema and the Creator toolbox with
starter content, draws its gaps inside the sentence with each one named to a screen
reader, and marks a mark per blank — partial credit, since a sentence with four gaps is
four decisions wearing one question. Quiz membership is asked of the blanks rather than
of the question, which inherits a `correctAnswer` that means nothing here.

Three definition diagnostics come with it. A `[[name]]` the question does not declare is
an error; a declared blank the template never positions is a warning; and a translation
naming a different set of blanks than the default is an error — a translation may move a
blank within the sentence, which is why the template is a translatable string, but
renaming, dropping or inventing one would make the answer keys depend on the language the
respondent happened to read.

Still to come: the C# runtime and the conformance cases.

Matching defaults live on the descriptors, so a blank trims surrounding whitespace and
ignores case unless it says otherwise — an assessment marking `paris` wrong is measuring
typing rather than geography.
