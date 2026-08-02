/**
 * The two rules that apply only to the dependency-free core packages: no DOM, and a
 * one-way internal layering. Extracted from check-arch.mjs so that file stays under the
 * repo's own 300-line limit — the limit applies to the enforcement scripts too.
 */
import { importSpecifiers } from './workspace.mjs';

// `EventTarget` earns its place here: a lint rule actively recommends it over our own
// emitter, and taking that advice would drag the DOM lib into a core package. See
// ADR-0013.
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

/**
 * Removes comments, leaving string literals intact.
 *
 * The DOM-free rule reads code, not prose. Scanning raw text failed the build over the
 * phrase "in document order" in a doc comment — a false positive that teaches people to
 * work around the checker, which is worse than not having it.
 *
 * Deliberately not a regex: `//` inside a string is not a comment, and a checker that
 * mangles strings would start missing the real thing it exists to catch.
 */
function stripComments(source) {
  let out = '';
  let mode = 'code';
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === 'code') {
      if (char === '/' && next === '/') {
        mode = 'line';
        index += 2;
      } else if (char === '/' && next === '*') {
        mode = 'block';
        index += 2;
      } else {
        if (char === "'" || char === '"' || char === '`') {
          mode = char;
        }
        out += char;
        index += 1;
      }
    } else if (mode === 'line') {
      if (char === '\n') {
        mode = 'code';
        out += char;
      }
      index += 1;
    } else if (mode === 'block') {
      if (char === '*' && next === '/') {
        mode = 'code';
        index += 2;
      } else {
        index += 1;
      }
    } else if (char === '\\') {
      out += char + (next ?? '');
      index += 2;
    } else {
      if (char === mode) {
        mode = 'code';
      }
      out += char;
      index += 1;
    }
  }
  return out;
}

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
