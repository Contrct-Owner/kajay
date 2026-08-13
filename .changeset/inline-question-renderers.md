---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Draw fields inside a sentence. A fill-in-the-blank's blanks are questions, so a gap can be
a dropdown, a multi-select, a yes/no, a rating or a computed value — a form authored by
writing a sentence rather than a row of boxes under a label.

Register how a type is drawn inline with `registerInlineQuestion(type, renderer)`. It is a
second registration rather than a mode on the existing one: absent by default, so a type
that cannot sit in a line of prose is refused by the definition and simply has no inline
renderer, and no renderer a host has already written has to learn a case it never heard of.

Inline controls are deliberately plainer than their block equivalents — a dropdown with
search and lazy paging does not belong in the run of a clause. A host that wants the fuller
thing registers its own.
