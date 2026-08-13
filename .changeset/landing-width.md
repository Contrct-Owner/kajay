---
'@kajay/core': patch
'@kajay/react': patch
'@kajay/creator-core': patch
'@kajay/creator-react': patch
'@kajay/themes': patch
---

The landing page uses the room the window gives it. It capped itself at `max-w-5xl` while
the documentation uses 96rem and the playground uses the whole width, so on an ordinary
monitor it was a narrow column with the screen empty on both sides — and inside that column
the hero split into halves from 768px, which left each side around 350px: the headline broke
into three lines, "No signup. Nothing saved." dropped under the button, and the hero
survey's own option labels wrapped.

The hero now splits at `lg` rather than `md`, with the words taking the larger share, so
below that width the two stack and the headline gets the whole measure.

No library changes; this is the marketing page only.
