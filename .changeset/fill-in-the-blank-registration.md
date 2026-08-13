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

Still to come: the definition diagnostics, the C# runtime, and the conformance cases.

Matching defaults live on the descriptors, so a blank trims surrounding whitespace and
ignores case unless it says otherwise — an assessment marking `paris` wrong is measuring
typing rather than geography.
