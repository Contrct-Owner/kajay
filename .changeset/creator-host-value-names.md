---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

Tell the Creator which `{$name}` host values a definition will be given, with the new
`hostValueNames` option on a workspace or design surface. Without it, a definition that
reads host context is reported as broken on a canvas — the diagnostic is right in general
and wrong here, because a designer has no host to supply anything.

**Names, not values.** There is no session, CRM or entitlement service behind a canvas, so
there is nothing true to show and an invented value would be a fiction a designer could
come to rely on. A declared name reads as unanswered, exactly as an absent host value does
at runtime; it simply stops being reported as undeclared.
