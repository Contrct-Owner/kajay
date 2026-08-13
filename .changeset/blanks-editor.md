---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

The Creator's blanks editor is a real editor. Its type picker offers the six types that can
sit in a line of prose — text, dropdown, multi-select, yes/no, rating, computed — rather
than all nineteen concrete question types, most of which the parser refuses as
`non-inline-blank` the moment they are added.

More importantly the sentence now moves with the collection: adding a blank positions it,
deleting one takes its marker out, and renaming one carries the marker along. Three of the
four ordinary editing operations used to leave the prose behind, two of them producing a
definition that does not parse. A marker is written into every language, because it is a
name rather than words and a translation naming a different set of blanks is its own error.

A child collection can now declare `markerProperty` — the owner's property whose `[[name]]`
markers position its children — which is the one registry fact all of that reads.

Renaming a blank did not rewrite `{q1.capital}` in expressions when this landed — an older
hole in every nested rename, fixed in the same release.
