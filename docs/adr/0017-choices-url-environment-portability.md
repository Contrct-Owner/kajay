# ADR-0017 — The host owns the origin in `choicesByUrl`

- Area: Core / choice sources
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

A survey definition is data. Customers promote the same document through environments —
`uat.acme.com` to `prod.acme.com` — and the whole value of promotion is that the artifact
reaching production is the one that was tested. An absolute URL inside the definition
destroys that: promoting now means *editing* the document, and what ships is not what was
signed off.

B10 shipped `choicesByUrl` without addressing this. Nothing else in the corpus did
either.

The intuitive workaround is to parameterise the URL with the placeholder syntax that
already exists — `choicesByUrl: "{baseUrl}/users"`, with `baseUrl` supplied per
environment. It does not work. Run against the built package:

```
requested URLs: [ '/users', 'https%3A%2F%2Fuat.acme.com/users' ]
```

Every substitution goes through `encodeURIComponent`, which is right for a query value
and fatal for an origin. Three structural problems sit behind that one:

1. `{...}` resolves against the **answer space** only. A base URL would have to be a
   question or calculated value — deployment configuration living in respondent data,
   and serialized into results the moment anyone sets `includeIntoResult`.
2. Every placeholder becomes a **graph dependency**, modelling the origin as something
   that changes during a session. It does not.
3. It would let a **respondent choose where the survey fetches from**. That is a
   data-exfiltration seam, not an inelegance.

Note also the first entry in that output. An unresolved placeholder silently becomes the
empty string, so a typo produces `/users` and a 404 with nothing explaining why.

## Decision

**The origin is the host's, never the definition's.** Two parts, one in force now and
one specified but deliberately unbuilt.

### 1. Definitions carry origin-relative URLs (in force)

```json
{ "type": "dropdown", "name": "owner", "choicesByUrl": "/users" }
```

```ts
parseSurvey(definition, {
  fetchJson: (url) => fetch(new URL(url, API_BASE)).then((response) => response.json()),
});
```

No code change was required: a path with no placeholders passes through `resolveUrl`
untouched. This is also where the seam already belongs — core is I/O-free
([ADR-0010](./0010-package-manifest-and-distribution.md)), so the host owns the network
boundary and therefore owns what the network means in its environment.

### 2. A deployment variable scope, `{@name}` (deferred)

Relative URLs assume one backend. When a definition needs two origins, or the API cannot
be served from the app's origin, the answer is a scope that is explicitly *not* the
answer space:

```ts
parseSurvey(definition, { fetchJson, endpoints: { usersApi: 'https://uat.acme.com' } });
```
```json
{ "choicesByUrl": "{@usersApi}/users" }
```

Recorded now so it is not re-litigated later, the rules are:

- **Substituted verbatim**, not percent-encoded. It is a URL prefix, not a value.
- **Never a graph dependency.** It is constant for the session. `{@usersApi}` already
  parses cleanly today and yields a reference path named `@usersApi`, so no tokenizer
  change is needed — but `placeholderDependencies` must filter the sigil explicitly, or
  it silently registers a dependency on an answer nobody will ever supply.
- **A separate namespace.** Collision with a question name is impossible by
  construction, which is the point of the sigil.
- **An undeclared name is a parse diagnostic**, at error severity — not the empty
  string. This is the largest single improvement over today's behaviour.
- **The template round-trips; the resolved value never serializes.** Same rule the
  loaded choices already follow, and required by
  [ADR-0002](./0002-round-trip-fixed-point.md).

**Trigger to build it:** the first definition that needs two origins, or the first host
that cannot serve its API from the app's origin. Not before — a variable scope with one
possible value is worse than a relative path.

### The invariant both parts preserve

**A respondent must never be able to influence the origin.** `{answer}` placeholders stay
confined to path and query segments, where percent-encoding is exactly right and a
hostile value can only produce a bad path — never a different host.

## Alternatives considered

**Absolute URL in the definition, rewritten during promotion.** Rejected. The artifact
reaching production is then not the artifact that was tested, which is the thing
promotion exists to guarantee. It also assumes an engineer is in the loop, when
definitions are authored through the Creator by people who are not.

**Base URL as an answer or calculated value.** Rejected on the evidence above: it is
mangled by encoding, it leaks configuration into results, and it hands the respondent the
origin.

**The host rewrites URLs by pattern-matching inside `fetchJson`** — swap the host
component of any absolute URL it sees. Rejected: implicit, invisible at the call site,
and it silently rewrites URLs an author meant literally.

**Environment-variable interpolation at parse time** (`${API_BASE}` from `process.env`).
Rejected outright. Core is DOM-free and runtime-agnostic; reaching for `process` breaks
the browser target and the zero-dependency rule in one move.

## Consequences

- Promotion needs no edit to the definition. The only thing that differs per environment
  is the host's `fetchJson`.
- A survey needing two origins has no answer until part 2 exists, beyond a host fetcher
  clever enough to route on path. That is the accepted cost of not building it yet.
- `apps/host-demo` keeps its absolute `jsonplaceholder.typicode.com` URL. It demonstrates
  a public third-party API, not deployment portability, and conflating the two would make
  the demo teach the wrong lesson. The B10 row says so.
- `new URL('/users', 'https://uat.acme.com/api')` discards `/api`. Hosts joining a base
  with a path must use a relative segment or join explicitly — worth stating in the
  integration guide when §H is written.

## Parent and related links

- [ADR-0001 — our own definition format](./0001-own-definition-format.md)
- [ADR-0002 — round-trip fixed point](./0002-round-trip-fixed-point.md)
- [ADR-0010 — package manifest and distribution](./0010-package-manifest-and-distribution.md)
- [Feature-parity checklist](../feature-parity-checklist.md) — §B10, §H
