---
'@kajay/creator-core': minor
'@kajay/creator-react': minor
---

`DesignSurfacePanel` takes an optional `onEditProperties`, which adds a "Properties" item
to every element's actions menu and reports the presses.

For hosts whose property grid is not permanently on screen. A sidebar layout needs nothing
here — selecting an element is already the whole gesture, because the grid is right there.
A layout that keeps the grid behind a sheet or a route has no such affordance, so the only
way to reach an element's properties was a control somewhere other than the element it is
about; on a phone that means scrolling away from the question to open a panel describing
it.

Reported rather than performed, like a toolbox pick: the panel cannot know where a host's
property grid is, so a menu item that opened one would be the piece deciding a layout it
cannot see. Absent rather than disabled when no host wired it, since an item that reports
to nobody does nothing when pressed.

Adds the creator string `properties`. Existing menu items keep their order and their ids.
