---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

A gap in a sentence is now laid out like part of the sentence.

- **One height** for the text field, the dropdown and the multi-select. They are three
  native controls whose default heights differ by a few pixels, and they aligned on their
  baselines, so the dropdown sat low and the line wobbled. They now share a height and
  align on their middles, and a checkbox takes its size from the words rather than staying
  a 13px square.
- **A gap is as wide as what it is for.** `size` on a blank and `blankSize` on the sentence
  were registered properties that nothing read, so every gap was the browser's default of
  twenty characters — a two-digit seat count claimed as much of the line as a full name.
  The renderer resolves them (a blank's own `size` wins) and publishes the result as
  `--kajay-blank-size`; where the browser supports `field-sizing`, an unsized gap now grows
  with what is typed into it.
- **`placeholder` reaches an inline gap**, in the text field and as the dropdown's empty
  option, as it always did in the block renderers. An empty gap can now say what goes in it.
- **A computed gap keeps its place while it is empty.** It collapsed to nothing, so the
  sentence read "which is  seat-months a year" — a hole a reader takes for a typo.
- **An error is read as part of the sentence.** `.kajay-question__errors` is a flex column,
  and one dropped between two words tore the line in half and stretched the gap to the
  width of the message.

The theme's inline rules are deliberately two classes deep so a host design system's own
input height does not leave one control in the sentence taller than its neighbours.
