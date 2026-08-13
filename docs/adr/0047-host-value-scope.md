# ADR-0047 — A host-value scope, `{$name}`

- Area: Core / expressions and logic
- Status: accepted, amended
- Owner: Jarod
- Last updated: 2026-08-12

## Context

A host frequently knows something the definition does not and the respondent must not
be asked: a customer's tier, a contract balance, an entitlement flag, a price computed
from a rate table. The survey needs to *use* it — branch on it in `visibleIf`, feed it
into a calculated value, show it on a page — without it becoming an answer.

Three shapes recur, and it is worth naming them because they do not all want the same
mechanism:

1. **A scalar known at load.** Region, tier, account age.
2. **A scalar computed later**, possibly asynchronously, possibly from answers — a quote
   for `{sku}` at `{qty}`, an eligibility check that has to leave the process.
3. **A structured payload** the definition navigates into — `{profile.plan.tier}`.

### What already works

Shape 2 is solved and shape 3 is solved by composition. `SurveyOptions.functions`
carries a host `FunctionRegistry` through `parseSurvey`, with both halves registered —
`register` and `registerAsync` (checklist B2). An asynchronous call yields `undefined`
on the pass that starts it and every rule that asked runs again when it lands. A
`calculatedvalue` whose expression is `hostProfile()` stores the returned object apart
from the answers, `includeIntoResult: false` keeps it out of the response, and
`createPathResolver` descends into objects and arrays — so `{profile.plan.tier}`
resolves today, against a value core never persisted.

That composition is genuinely good and this ADR removes none of it.

### Why it is not enough

**1. It is pull-only, and the pull happens once.** `AsyncFunctionCache` keys results on
name *and* arguments and never invalidates them; a failure is recorded and never
retried. That cache is load-bearing rather than an optimisation — without it, each
re-evaluation restarts the call and each call triggers another re-evaluation — but it
means a host value that changes during a session cannot be updated at all. There is no
seam to invalidate it and no seam to push a new one.

**2. Prefill has nowhere to go but the answer space.** `setData` and `setValue` write
into `SurveyAnswers`. Anything a host puts there is in `survey.data`, in
`SurveyProgress`, in the Response Snapshot ([ADR-0034](./0034-portable-response-snapshot-contract.md)),
subject to the clear-invisible policy (E9) and reachable by triggers — and a respondent
can overwrite it, because it is an answer and answers are theirs. Host context becomes
respondent data by the only route available.

**3. Reading a host value costs a function call at every site.** `hostValue('tier') =
'gold'` is what a definition must say today. It cannot be checked at parse time, the
Creator's expression autocomplete lists it as a *function* rather than offering the
names, and it reads as computation where the author means a lookup.

### The syntax is already available

`{@name}` needed no tokenizer change ([ADR-0017](./0017-choices-url-environment-portability.md))
because `readReference` takes everything between the braces verbatim and
`parseReferencePath` only splits on `.` and `[`. The same is true of `$`. Run against
the current source:

```
{$tier}
  path:  [{"kind":"name","name":"$tier"}]
  errors: []
{$profile.plan.tier}
  path:  [{"kind":"name","name":"$profile"},{"kind":"name","name":"plan"},{"kind":"name","name":"tier"}]
  errors: []
{$tier} = "gold"
  refs:  [[{"kind":"name","name":"$tier"}]]
```

Path descent, structured values and use as an operand all fall out of what exists. What
is missing is resolution, ownership, and settlement — not grammar.

## Decision

**A host-value scope addressed as `{$name}`: supplied by the host, readable by every
expression, writable during a session, and never part of the response.**

```ts
const { survey } = parseSurvey(definition, {
  values: { tier: 'gold', profile: { plan: { tier: 'gold' }, seats: 40 } },
});

survey.setHostValue('quote', 1240.5); // later, from anywhere the host likes
```

```json
{ "type": "panel", "name": "enterprise", "visibleIf": "{$profile.plan.tier} = 'gold'" }
```

The rules, in force together:

1. **Its own namespace.** Resolution tests the sigil before consulting the answers, so
   collision with a question name is impossible by construction — the property that
   makes `{@name}` safe, for the same reason.

2. **Host-writable, expression-readable, respondent-inert.** `SurveyOptions.values` at
   parse and `setHostValue` afterwards are the only writes. No trigger, no `setValueIf`,
   and no respondent input can reach the scope.

3. **A real dependency-graph node.** This is where the scope departs from `{@name}`, and
   the reason it needs its own record rather than an amendment to ADR-0017. An endpoint
   is constant for the session and is deliberately filtered *out* of the graph; a host
   value changes during one, and a `visibleIf` reading it that did not re-run would be a
   panel that stays hidden after the host says otherwise.

4. **A write settles like any other.** `setHostValue` goes through the same settle
   `setValue` does — never around it. [ADR-0004](./0004-explicit-dependency-graph.md)'s
   invariant is not weakened for a new kind of root: events stay buffered until the
   cascade finishes, and no observer sees the model part-way through one.

5. **Never in `data`, never in a snapshot — structurally.** Not by a filter on the way
   out. `SurveyProgress` already has to exclude calculated values by name, and adding a
   second exclusion list would mean the snapshot, the progress record, the clearing
   policy and the trigger surface each need the same list: four chances to install
   three. A host value is not in the answer store, so there is nothing to exclude.
   Unlike a calculated value there is **no `includeIntoResult` opt-in** — a host that
   wants the value in the response authors a calculated value that reads it, which
   states the intent in the definition where a reviewer can see it.

6. **Values are JSON.** Scalars, objects, arrays; path descent as proven above. Not
   markup — see below.

7. **An unresolved name yields `undefined`, and is a parse diagnostic at _warning_
   severity.** Warning rather than B11's error, and the difference is not an
   inconsistency: an endpoint must be present at parse or the fetch is already doomed,
   whereas a host value may legitimately be supplied by `setHostValue` after parsing,
   so error severity would fail definitions that are correct. `undefined` is also the
   honest unresolved value here, where the empty string was the defect in B11 — every
   operator already treats `undefined` as an unanswered question, so nothing needs a
   third state.

8. **The sigil is reserved in `name`.** A definition naming a question `$tier` gets a
   diagnostic, because resolution checks the sigil first and that question would
   otherwise be silently unreachable from every expression.

9. **The template round-trips; the value never serializes.** `{$tier}` survives a
   round-trip as written, and what it resolved to appears in no document
   ([ADR-0002](./0002-round-trip-fixed-point.md)).

### The scope reaches templates, not only expressions

**Amended 2026-08-12, after the read path shipped.** The rules above say "readable by
every expression" and stop there, which left `{$tier}` resolving in a `visibleIf` and
rendering as an empty string in `completedHtml` — the templates are interpolated by
`interpolateHtml` against the answers, a different mechanism the wording never reached.

That is the empty-string failure ADR-0017 named as the worst defect in the endpoint
scope, reappearing one layer up, and a scope that works in conditions but blanks in
prose is the harder half of the feature to trust. So the status templates —
`completedHtml`, `loadingHtml`, `emptyHtml` and a conditional ending's `html` — resolve
the host scope too, sigil first, exactly as expressions do.

Two details fixed with it:

- **A host reference is resolved whole.** `{$profile.plan.tier}` descends in a template
  because it is parsed by the same `parseReferencePath` an expression goes through. A
  template splitting on dots itself would be a second reader of one syntax, free to
  disagree with the first.
- **Answers keep flat-name lookup**, deliberately asymmetric. An answer written by
  `setValue` under a key containing a dot resolves in a template today, and would start
  resolving to nothing the day templates began splitting them. The host scope has no
  such shipped behaviour to protect, so it starts consistent with expressions instead of
  starting bug-compatible.

Values are still **escaped** on the way in. The template is the author's markup and the
value is not, whoever supplied it — a host value is frequently derived from respondent
data, and `interpolateHtml`'s trust boundary is unchanged by where the value came from.

**Not fixed here, and named so it is not mistaken for part of this:** a template
placeholder naming something nobody supplied is silently empty *for every scope*. A
typo'd `{plantypo}` has always rendered blank with no diagnostic, and so does a typo'd
`{$tier}`. Diagnosing template references is a real gap, it is pre-existing and
scope-wide, and half-fixing it for the host scope alone would bake in an asymmetry
nobody could later explain. It wants its own change.

### Companion: asynchronous results become invalidatable

`survey.invalidateAsyncResults(name?)` clears `AsyncFunctionCache`'s results *and* its
failure map, then re-evaluates. This is a small change and it is required by the same use
case: a host whose quote service was down has no way to ask again, and one whose rate
table changed has no way to say so. It is recorded here rather than separately because
"the host's computed value changed" is one problem with a pull half and a push half, and
shipping only the push half leaves the pull half permanently stale.

**Renamed 2026-08-12, on building it.** This was written as `invalidateHostValues()`,
which is wrong in the way that matters: by then `{$name}` had made "host value" a
precise term, and the method discards none of them. What it discards is what
*asynchronous expression functions* returned. A host reading the old name would
reasonably expect their tier and quote to be thrown away.

Two details the implementation settled:

- **A reply already in flight is discarded, not installed.** Invalidation advances a
  generation and a late reply checks it, the same guard `ChoicePager` already uses for
  a superseded page. Without it the request outstanding *at* the moment of invalidation
  lands afterwards and writes the stale answer over the fresh one, leaving the survey
  showing exactly what the host invalidated with nothing left to correct it. A mutation
  removing the guard is killed by one test and only that test.
- **Pending keys are cleared as well as superseded.** `request` starts work only for a
  key nothing is already waiting on, so a key left pending would never be asked again.

### Markup is not a value

Shape 3 sometimes means "the host computed some HTML". That does **not** enter this
scope. Core is DOM-free, and `interpolateHtml` escapes every substituted value on
purpose — the template is the author's markup and the value is untrusted, which is the
whole reason completed-page interpolation is safe. Host-computed markup belongs in the
adapter, through a slot element the host renders with its own component, on the same
reasoning as `renderText` and `sanitizeHtml`: the library never inserts markup it did
not build. That is a separate decision and is out of scope here; it is written down so
the two are not conflated later.

## Alternatives considered

**Extend `{@name}` to carry arbitrary JSON.** Rejected. ADR-0017 fixed three properties
on that scope — substituted verbatim, never a graph dependency, a URL prefix and not a
value — and a host value needs the opposite of two of them. One sigil meaning two things
is exactly how `{...}` broke when someone reached for it to parameterise a URL.

**Host values as answers, filtered on the way out.** Rejected on rule 5. The filter is a
list somebody maintains, in four places, and it does not address the respondent being
able to overwrite the value in the first place.

**Keep the status quo: one host function per value.** Rejected on the three problems in
the context. It is also the workaround that will be built anyway if this is deferred,
which is the argument ADR-0017 made for not gating B11 on a trigger.

**A general scope chain**, of which the host scope is one frame. Rejected.
`ExpressionScope` exists for exactly one case — `row` inside a matrix total — and says
so: one scope is all anything has needed. A chain is a second name-resolution system to
keep honest across two runtimes and the conformance corpus, bought to serve one new
frame.

**Re-parse the survey with new options when a host value changes.** Rejected. It
discards answers, the current page, timer state and every async result, to deliver a
value change.

## Consequences

- **A new kind of graph root.** Conformance v2 needs adapter-neutral cases for
  resolution, for the settlement ordering of a host-value write against answer writes,
  and for canonicalization of `{$name}` in a template. Behaviour claimed by one runtime
  and not the other is what the corpus exists to prevent.
- **C# parity.** `SurveyOptions` gains the initializer and the runtime gains the writer,
  under §Q — Q8 is the host-I/O row and this is host I/O.
- **Contracts regenerate.** Two new definition diagnostic codes (unresolved host value,
  reserved-sigil name), committed in the same PR, `check:contract` green.
- **Checklist B12**, green only via a named proof, not by assertion.
- **The Creator has no host.** Expression autocomplete can only offer host-value names if
  it is told them, so `creator-core` needs a declared list — a designer surface with no
  runtime behind it. Named as a gap rather than solved here.
- **One behaviour change to something already shipped:** asynchronous results stop being
  permanent for the life of a survey. It needs its own proof, and hosts relying on
  never-retried failures (nobody should be) would see a retry after an explicit
  invalidation only.
- **A question named `$tier` stops being addressable** and starts being diagnosed. No
  definition in the corpus has one; a host that has shipped one has a breaking change.
- Nothing existing is removed. `hostValue('tier')`-style functions keep working, and the
  function-plus-calculated-value composition remains the right answer whenever the value
  is genuinely *computed from answers* rather than supplied.

## Parent and related links

- [ADR-0002 — round-trip fixed point](./0002-round-trip-fixed-point.md)
- [ADR-0004 — core reactivity: explicit dependency graph](./0004-explicit-dependency-graph.md)
- [ADR-0017 — the host owns the origin in `choicesByUrl`](./0017-choices-url-environment-portability.md)
- [ADR-0034 — portable, definition-bound response snapshots](./0034-portable-response-snapshot-contract.md)
- [Feature-parity checklist](../feature-parity-checklist.md) — §B2, §B6, §B11, §B12, §Q8
- [Conformance v2](../../conformance/v2/README.md)
