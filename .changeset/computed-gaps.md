---
'@kajay/core': minor
'@kajay/react': minor
'@kajay/creator-core': minor
'@kajay/creator-react': minor
'@kajay/themes': minor
---

A fill-in-the-blank gap can now be a computed value: "we have [[seats]] seats, which is
[[annual]] a year". A blank's rules are registered with the logic graph like a matrix
cell's, so a computed gap recomputes when the gap it reads changes — and a `setValueIf`,
`resetValueIf` or `defaultValueExpression` on any blank now works for the same reason.

A blank's expression names the whole path, `{plan.seats}` rather than `{seats}`, because
that is where the answer lives and how a multiple-text field is already read from anywhere
else.

The .NET runtime did not compute `expression` questions at all when this landed, so a
computed gap was empty there; that older gap is fixed in the same release.
