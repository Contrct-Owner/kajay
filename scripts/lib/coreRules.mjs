/**
 * The two rules that apply only to the dependency-free core packages: no DOM, and a
 * one-way internal layering. Extracted from check-arch.mjs so that file stays under the
 * repo's own 300-line limit — the limit applies to the enforcement scripts too.
 */
import { importSpecifiers, stripComments } from './workspace.mjs';

// `EventTarget` earns its place here: a lint rule actively recommends it over our own
// emitter, and taking that advice would drag the DOM lib into a core package. See
// ADR-0013.
//
// Sharp edge, met once and worth knowing about: comments are stripped before this runs
// but **string literals are not**, so a core package cannot use these words in prose
// either — `keywords: ['document']` in the Creator's toolbox tripped it. Left as is on
// purpose. Stripping strings would mean skipping regex literals correctly to avoid
// swallowing a real reference, and a checker that misses a violation is worse than one
// that occasionally objects to a word. Rename the string; if this bites a second time,
// fix it properly rather than working around it again.
const DOM_GLOBALS = [
  'document',
  'window',
  'navigator',
  'localStorage',
  'HTMLElement',
  'EventTarget',
  'customElements',
];

/**
 * Layers inside `@kajay/core` point one way.
 *
 * The expression language, the dependency graph and the logic engine are the reusable
 * kernel; the model sits on top of them. A rule factory reaching back into the model
 * looks harmless — it only wanted `ItemValue` — but it makes the kernel untestable
 * without constructing a survey, and it is how a cycle starts. Both carry-forward and
 * URL choices were written that way, and both have since been inverted.
 *
 * Listed inner-first: each layer names what it may not reach for.
 */
const CORE_LAYERS = [
  { dir: 'expressions', mayNotImport: ['dependencies', 'logic', 'model', 'serialization'] },
  { dir: 'dependencies', mayNotImport: ['logic', 'model', 'serialization'] },
  { dir: 'metadata', mayNotImport: ['logic', 'serialization'] },
  { dir: 'logic', mayNotImport: ['model', 'serialization'] },
];

function checkDomFree(source, location, packageName, fail) {
  const code = stripComments(source);
  for (const domGlobal of DOM_GLOBALS) {
    if (new RegExp(String.raw`\b${domGlobal}\b`, 'u').test(code)) {
      fail(
        'core-dom-free',
        location,
        `Core package "${packageName}" references DOM global "${domGlobal}".`,
      );
    }
  }
}

function checkLayering(source, location, packageName, fail) {
  if (packageName !== '@kajay/core') {
    return;
  }
  const layer = CORE_LAYERS.find(({ dir }) => location.includes(`src/${dir}/`));
  if (layer === undefined) {
    return;
  }
  for (const specifier of importSpecifiers(source)) {
    const target = /^\.\.\/([^/]+)\//u.exec(specifier)?.[1];
    if (target !== undefined && layer.mayNotImport.includes(target)) {
      fail(
        'core-layering',
        location,
        `"${layer.dir}" imports from "${target}", which sits above it. Invert it: let the caller pass in what the rule needs.`,
      );
    }
  }
}

/** Applies every core-only rule to one file. `fail` reports; nothing is thrown. */
export function checkCorePackageRules(source, location, packageName, fail) {
  checkDomFree(source, location, packageName, fail);
  checkLayering(source, location, packageName, fail);
}
