---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Renaming a *nested* thing in the Creator now carries the references to it. A name is
written in two syntaxes — `{who}` names a question outright, `{plan.seats}`,
`{grid[0].size}` and `{row.size}` name something inside one — and only the first was ever
followed. Renaming a blank, a matrix column or a question in a repeating panel left a
survey that still parses, still renders and quietly stops working. Duplicating a matrix was
worse: its columns were renamed, so `{row.size}` in the copy named a column that had just
been renamed out from under it.

The rewrite is qualified rather than textual: a tail moves only under the owner that holds
the renamed child, or under the owner's record word inside the owner itself. Rewriting
every `.size` in every expression would have corrupted `{$profile.size}` — a host value
with a key of that name and nothing to do with the rename.

A repeating type now publishes its record word as `recordScope` on its registration —
`row` for a matrix, `panel` for a repeating panel — so an authoring tool can read the
language's word instead of keeping a copy of it.
