---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Update host values during a session with `survey.setHostValue(name, value)`. Everything
reading the value recomputes before the call returns — conditions, calculated values,
and the status templates — inside one settle, so a listener woken by the change sees a
model that has finished reacting to it.

Writing the value already in force does nothing at all, so a host that refreshes its
context on a timer cannot make the survey re-evaluate for a value that did not move.

A host value change is deliberately **not** reported through `onValueChanged`: that
event means an answer changed, and a host value is in no response for a listener to go
and read. What the respondent can see change is announced as element state, as always.
