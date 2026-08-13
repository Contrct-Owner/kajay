---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Ask asynchronous expression functions again with `survey.invalidateAsyncResults(name?)`.
Their results are cached for the life of a survey — which is what stops each
re-evaluation restarting the call that caused it — and that is right until the world
those answers describe moves. Naming one function discards only its results; naming none
discards them all. Everything affected re-evaluates and the answers land as any
asynchronous answer does.

**This is also the only way back from a failure.** A rejected call is recorded and never
retried, so before this a lookup that failed once stayed failed for the life of the
survey.

A request already in flight when you invalidate is discarded rather than installed, so a
superseded reply cannot overwrite the fresher one it raced.
