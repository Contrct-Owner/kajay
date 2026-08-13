---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

The multi-select gap in a sentence is no longer a native `<select multiple>`.

It was the one control in a sentence whose *contents* the browser drew for itself — in
Chrome a popup whose checkbox glyphs follow neither `color-scheme` nor any rule a
stylesheet can write, in Firefox a one-line scroller — so it was the one gap a theme could
not reach. A dark survey showed white boxes down a dark list, two lines below a checkbox
group that themed perfectly.

It is now a disclosure over the host's own `Checkbox` primitive, one per choice: the same
control the block checkbox group draws, so a design system's checkbox reaches a sentence
too. A button says what was chosen in the author's words, `aria-expanded` says whether the
choices are showing, and the menu is a popover in the top layer — a survey lives inside
somebody else's layout, and an absolutely positioned menu is cut off by the first ancestor
that hides its overflow.

A theme also declares `accent-color` now, alongside `color-scheme`: the two together are
what reach the parts of a native control no rule can select — the tick in a checkbox, the
dot in a radio, the fill of a range.
