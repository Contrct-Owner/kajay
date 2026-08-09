---
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Property explanations are shown on demand instead of always.

Every property row carried its description permanently, so a question with thirty
properties gave a panel that was mostly prose. The descriptions are still there — the
field still points at them with `aria-describedby`, so a screen reader reads them exactly
as before — and the stylesheet now reveals them when they are wanted: hovering the marker
beside a property's name, or working in its field, which is how a keyboard and a touch
reach it.

The marker is deliberately not a control and takes no tab stop of its own, and the
explanation appears in place rather than over the row below.

The expression editor's suggestion popup is no longer rendered when it holds nothing:
every expression property used to contribute an empty `role="listbox"` to the document.
