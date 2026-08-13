---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Read host-supplied values from expressions with the new `{$name}` scope. Pass them as
`parseSurvey`'s `values` option and any expression can read them — `visibleIf`,
`defaultValueExpression`, a calculated value — including descent into structured values
such as `{$profile.plan.tier}`. Host values are not answers: they never appear in
`data`, in progress, or in a response snapshot, and a respondent cannot overwrite them.

Two new definition diagnostics come with it. An expression naming a value the host did
not supply is reported as a **warning**, because it may legitimately be supplied later,
and it evaluates as unanswered rather than as an empty string. An element whose `name`
starts with `$` is reported as an **error**: the sigil is now reserved, and such an
element cannot be reached from any expression. The authored name is kept rather than
rewritten, so definitions and recorded responses are unaffected.
