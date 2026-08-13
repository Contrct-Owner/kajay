---
'@kajay/core': patch
'@kajay/react': patch
'@kajay/creator-core': patch
'@kajay/creator-react': patch
'@kajay/themes': patch
---

The .NET runtime now computes `expression` questions, on a page and in a sentence. It never
had: one was built as a plain scalar with no rule behind it, so it stayed empty for ever and
any survey holding one answered differently in the two runtimes. An expression question is
now the calculated value it always was — same graph, same ordering — and a computed gap
writes inside its sentence's answer at `plan.annual`, exactly where TypeScript puts it.

A calculated value with no result is also no longer carried in the .NET response. An
untouched survey used to answer `{ "total": absent }`, an entry TypeScript has never had; the
value is still recorded and still readable through `TryGetCalculatedValue`.

Two conformance scenarios now hold both runtimes to it. No TypeScript behaviour changes here.
