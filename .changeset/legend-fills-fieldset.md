---
'@kajay/themes': patch
---

A group question's title no longer wraps in Firefox.

Seven question types draw their title as a `legend`, because a control that is a *group*
needs a fieldset for the title to be the group's name. A legend is not laid out like its
siblings: engines shrink it to its own content rather than giving it the box's width, and
Firefox then rounds that a fraction under what the text measured — so `How was it?` broke
in half with hundreds of pixels free beside it, while Chromium rendered it on one line.

The title now takes the width of its box, in every engine.
