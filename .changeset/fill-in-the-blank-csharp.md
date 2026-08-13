---
'@kajay/core': patch
'@kajay/react': patch
'@kajay/creator-core': patch
'@kajay/creator-react': patch
'@kajay/themes': patch
---

Fill-in-the-blank is now implemented by both runtimes, and the conformance corpus carries
the cases they have to agree on: the template round-trips with its markers, and a
translation that renames a blank is refused in either language.

No TypeScript behaviour changes here — the corpus and the native SDK caught up with it.
