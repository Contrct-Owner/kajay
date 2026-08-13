---
'@kajay/core': patch
'@kajay/react': patch
'@kajay/creator-core': patch
'@kajay/creator-react': patch
'@kajay/themes': patch
---

Show the field kinds a sentence can hold. The playground gains an examples list with a
fill-in-the-blank whose every gap is a different question — text, dropdown, multi-select,
rating and yes/no in one sentence.

`expression` is no longer allowed inline. It reads well mid-clause, but a blank's rules are
not registered with the logic graph, so a computed gap would draw an empty space for ever;
the definition refuses the type rather than letting it silently do nothing.

An inline multi-select is one row tall and scrolls, instead of opening into a list box that
pushes the sentence apart.
