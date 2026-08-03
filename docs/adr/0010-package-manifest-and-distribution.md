# ADR-0010 — Package manifest shape, Node floor, and CSS distribution

- Area: Packaging and distribution
- Status: accepted
- Owner: Jarod
- Last updated: 2026-08-02

## Context

Three questions surfaced while working through the North Star's open decisions, all of
which Phase 0 forces because the pack test installs real tarballs into a scratch
project: what Node versions the published packages support, what shape the `exports`
maps take, and how a host gets the stylesheet out of `@kajay/themes`.

These are one decision, not three — they are all the published manifest.

## Decision

### Node floor: `>=22.12.0`

Declared as `"engines": { "node": ">=22.12.0", "npm": ">=10" }` on every published
package.

Node 20 reached end of life in April 2026, so 22 is the oldest line still receiving
support. `22.12.0` specifically is the release where `require(esm)` became unflagged
on the 22 line — which matters directly for an ESM-only library, because it is what
lets a CommonJS consumer `require()` our packages at all.

CI runs the matrix on **22 and 24**. Add 26 when it reaches LTS in October 2026;
drop 22 when it reaches end of life in April 2027.

No `packageManager` field and no reliance on corepack — use the npm that ships with
Node and let `engines` express the floor. This is the boring, solo-operable option
([North Star principle 6](../NORTH_STAR.md)) and removes a moving part from CI.

> **Superseded by [ADR-0015](./0015-pnpm-workspace.md) (2026-08-02).** The workspace
> now uses pnpm, pinned via `packageManager` and supplied by corepack. The reasoning
> above held only while npm was the sole requirement; once pnpm is needed, something
> must supply it, and corepack is the mechanism that pins the version in-repo. The
> **published manifest** decisions in this ADR — Node floor, ESM-only, single root
> export entry, host-imported CSS — are unaffected, as is `engines.npm` on published
> packages, which constrains consumers rather than this workspace.

### `exports`: a single root entry per package

```jsonc
{
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./package.json": "./package.json"
  }
}
```

No `main`, no `module`, no `browser` fallback: the packages are ESM-only and `exports`
is authoritative. No subpath entries except the themes CSS exception below.

The decisive reason is enforcement, not ergonomics. With exactly one entry, the
deep-import architecture check becomes a one-line rule — any specifier matching
`@kajay/<pkg>/<anything>` that is not in the map is a violation — rather than a
policy that has to be maintained in step with a growing subpath list. It also gives
the contract one surface to document and the pack test one entry to import.

Tree-shaking is handled by `"sideEffects": false`, which is what bundlers actually
use; subpaths are not needed for it.

Accepted cost: tooling that still reads `main` will not resolve these packages. Given
ESM-only and a TypeScript ~6 audience, that tooling is already excluded.

### CSS distribution: explicit host import, never injected

`@kajay/themes` is the one package with subpath exports, because stylesheets have no
other delivery mechanism:

```jsonc
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./styles.css": "./dist/styles.css",
    "./themes/*.css": "./dist/themes/*.css",
    "./package.json": "./package.json"
  }
}
```

The root entry is JavaScript: theme JSON objects and their types, applied at runtime
per checklist I2. The CSS subpaths are the token and component stylesheets.

**No JavaScript package imports CSS.** `@kajay/react` and `@kajay/creator-react` ship
no stylesheet import; the host writes `import "@kajay/themes/styles.css"` itself. This
keeps `sideEffects: false` honest, keeps the packages safe to import in a server
render, and avoids imposing a CSS build pipeline on consumers who want to ship their
own tokens.

## Consequences

- `files` in each manifest must include the emitted CSS, and the **pack test must
  import a CSS subpath from an installed tarball**. A `files` field that silently
  omits stylesheets is a classic packaging break that workspace symlinks hide
  completely — this is precisely the failure the pack test exists to catch.
- The architecture check gains a concrete rule to implement in Phase 0 (single-entry
  enforcement) rather than an abstract "no deep imports" aspiration.
- Adding a subpath to any package later is an ADR-level change, not a casual edit,
  because it weakens the enforcement rule above.
- The Node floor is a published compatibility contract and moves only by ADR
  amendment, on the LTS schedule recorded above.

## Parent and related links

- [North Star §5, §8](../NORTH_STAR.md)
- [Library development guidelines](../library-development-guidelines-details.md)
- [Feature-parity checklist §I1, §I2](../feature-parity-checklist.md)
