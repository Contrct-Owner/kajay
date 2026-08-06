---
'@kajay/core': major
---

Use Kajay's invariant decimal grammar for expression numeric coercion. Hexadecimal,
binary, octal, empty, locale-formatted, and non-finite text no longer acts as a number,
booleans no longer coerce to zero or one, and arithmetic overflow produces an absent
value instead of a non-finite JavaScript number. Equality now follows Kajay value kinds
instead of converting unlike values to host-language text. Explicit expression text
conversion uses invariant Kajay spellings rather than host defaults, and never
implicitly stringifies arrays or objects.
