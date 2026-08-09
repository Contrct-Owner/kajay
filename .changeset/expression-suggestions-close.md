---
'@kajay/creator-react': patch
---

The expression editor's suggestion list closes when you leave the field.

It opened on a keystroke and shut only on Escape or on accepting a suggestion, so typing
in `visibleIf` (or any expression property) and then clicking elsewhere left the list
standing over the property grid indefinitely — attached to a field no longer being edited,
offering completions for a token nobody was writing.

Choosing an option with the pointer is unaffected: the options cancel their own
`mousedown`, so picking one never moves focus out of the field.
