---
'@kajay/core': patch
'@kajay/react': patch
'@kajay/creator-core': patch
'@kajay/creator-react': patch
'@kajay/themes': patch
---

The playground can show the response as well as the definition. The live survey pane has an
Answer/JSON switch, and the JSON is `survey.data` — the shape a host posts to its own
backend — updating as the survey is answered.

It is a view rather than a mode: the form stays mounted while hidden, so a half-typed field
keeps its caret and its scroll position while a visitor looks at what it produced.

No library behaviour changes here; this is the reference application showing what it
already had.
