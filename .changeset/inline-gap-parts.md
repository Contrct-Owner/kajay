---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

A gap in a sentence is now drawn from the same parts as the control on a line of its own,
and a theme says which way round its colours run.

- **A theme declares its `colorScheme`**, published as `--kajay-color-scheme` and spent by
  the stylesheet as `color-scheme`. It is the only thing that reaches the parts of a
  control no stylesheet can: the list a `<select>` opens, the tick in a checkbox, the
  scrollbars. A dark survey that never said so opened a **white** list full of its own pale
  text, in every dropdown, inline or not.
- **A yes/no gap is the switch the block renderer draws** — the host's `Checkbox`
  primitive wearing `kajay-boolean__switch` — rather than a bare `<input type="checkbox">`
  no design system had ever styled.
- **A choice gap is the block dropdown's select**: same class, same rows, same read-only
  behaviour. Two bugs came with the old copy — a choice authored as `1` came back as
  `"1"`, because the answer was read straight off `event.target.value`, and a read-only gap
  was `disabled`, which drops it out of the tab order instead of leaving it readable.
- **A placeholder is a prompt, not a choice.** It is hidden from the list in both
  renderers: visible, "a department" sat between Engineering and Design and read as a
  department of that name. A question that may go unanswered keeps a blank row, because a
  native select has no undo.

`ChoiceOptions` is now shared by both renderers, which is what stops the two drifting apart
again.
