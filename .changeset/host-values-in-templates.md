---
'@kajay/core': patch
'@kajay/react': patch
'@kajay/creator-core': patch
'@kajay/creator-react': patch
'@kajay/themes': patch
---

Resolve `{$name}` host values in `completedHtml`, `loadingHtml`, `emptyHtml`, and a
conditional ending's `html`, not only in expressions. A completed page can now say
"Thank you, {$tier} customer" and mean the value the host supplied, where it previously
rendered blank.

A host reference is resolved whole, so `{$profile.plan.tier}` descends in a template
exactly as it does in an expression. Answer placeholders are unchanged and are still
looked up by flat name. Values are escaped on the way in, as every interpolated value
already was.
