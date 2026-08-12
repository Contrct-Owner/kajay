---
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

`SurveyCreator` gets a compact designer on narrow screens.

Below 60rem the assembly used to stack its three panels, and stacking put the toolbox
first: a designer on a phone opened their survey and found thirty question types where it
should have been, then scrolled past all of them to reach the thing they came to edit.

The canvas now takes the full width, and the toolbox and property grid move behind two
buttons that open a modal `<dialog>` anchored to the bottom of the viewport. The action bar
is sticky, so it stays in reach however long the survey grows, and lets go where the
designer ends rather than floating over the rest of a host's page. The toolbox shuts itself
on a pick; the property grid does not, because editing properties is a run of changes
against one element. Selecting an element deliberately does not open a panel — adding a
question selects it, so a panel that opened itself would cover the canvas at the moment the
designer wanted to see what landed. Its own actions menu offers "Properties" instead, via
the `onEditProperties` seam.

A real `<dialog>` opened with `showModal()`, so the focus trap, Escape, the inert
background and the backdrop come from the platform rather than from a dependency this
package does not have.

Which layout is measured rather than styled, because the two are different component trees
and rendering both would put two toolboxes in one document. The threshold matches the
stylesheet's own and is written in both places, each pointing at the other.

Adds the creator strings `toolbox`, `addQuestion` and `closePanel`. Nothing at or above
60rem changes.
