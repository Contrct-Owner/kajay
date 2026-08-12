---
'@kajay/core': patch
---

Announce a failed URL choice load, so a view can show it. A recorded `choiceErrors` entry
changed nothing a reader could see: nothing told the renderer to look again, so a question
whose choices could not load was indistinguishable from one still loading them. Both
failure paths — a rejected fetch and a missing fetcher — now reach the same renderer
channel a successful load does. Choices from an earlier successful load are kept rather
than cleared, since a stale list is more use than an empty one and the error says which
attempt failed.
