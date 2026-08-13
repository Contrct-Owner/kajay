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

This is registration and schema only: the type parses, round-trips and appears in the
survey schema, the runtime metadata contract and the Creator toolbox with starter
content. Template parsing, the answer object, marking and rendering follow.

Matching defaults live on the descriptors, so a blank trims surrounding whitespace and
ignores case unless it says otherwise — an assessment marking `paris` wrong is measuring
typing rather than geography.
