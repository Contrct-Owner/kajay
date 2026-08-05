---
'@kajay/core': major
---

Use Kajay's invariant decimal grammar for expression numeric coercion. Hexadecimal,
binary, octal, empty, locale-formatted, and non-finite text no longer acts as a number,
booleans no longer coerce to zero or one, and arithmetic overflow produces an absent
value instead of a non-finite JavaScript number.
