import { isLocalizedText } from '@kajay/core';
import type { MetadataRegistry, SurveyDefinition } from '@kajay/core';
import { isDefinition, rewriteNamed } from './definitionWalk.js';

/**
 * The prose and the blanks it positions, kept in step — checklist C13, ADR-0048.
 *
 * A blanks collection is not a list, it is a set of *places in a sentence*: a blank the
 * template never names is invisible, and a marker naming a blank nobody declared is an
 * error the parser refuses. So every edit to the collection is really two edits, and
 * before this module ordinary use of the collection editor produced definitions that do
 * not parse — adding a blank left it unpositioned, deleting one left `[[gone]]` behind,
 * and renaming one left the old marker pointing at nothing.
 *
 * **Every locale, not the one on screen.** A translation naming a different set of blanks
 * is its own error (`locale-blank-mismatch`), so a marker added to the default prose and
 * to nothing else breaks a survey the moment it has a translation. A marker is a *name*
 * rather than words, which is what makes writing it into every language correct: the
 * translator moves it into place, exactly as they may move the ones already there.
 */

/** The marker a blank of this name is positioned by. */
function marker(name: string): string {
  return `[[${name}]]`;
}

/** Appends a marker for a blank that has just been declared. */
export function positionMarker(
  definition: SurveyDefinition,
  owner: string,
  markerProperty: string,
  name: string,
): SurveyDefinition {
  return rewriteMarkerText(definition, owner, markerProperty, (prose) =>
    // At the end, and never in the middle: no sentence has a right place for a field
    // nobody has written the words around yet. A designer drags it where it belongs, and
    // until they do it is at least visible — which "declared but unpositioned" is not.
    prose.length > 0 ? `${prose.trimEnd()} ${marker(name)}` : marker(name),
  );
}

/** Takes a removed blank's marker out of the prose it was positioned in. */
export function unpositionMarker(
  definition: SurveyDefinition,
  owner: string,
  markerProperty: string,
  name: string,
): SurveyDefinition {
  return rewriteMarkerText(definition, owner, markerProperty, (prose) =>
    // The space before it goes too, or "the [[a]] is [[b]]." becomes "the [[a]] is ." —
    // punctuation adrift from the word it belongs to, in every translation at once.
    prose.replaceAll(new RegExp(String.raw` ?${escape(marker(name))}`, 'gu'), '').trim(),
  );
}

/**
 * Follows a rename into the prose, wherever a marker names the old name.
 *
 * Applied to the definition the rename has already produced, so the collection holds the
 * new name and only the markers are behind. Every element the registry says positions its
 * children this way is visited, rather than the one that happens to be a sentence.
 */
export function renameMarkers(
  definition: SurveyDefinition,
  registry: MetadataRegistry,
  from: string,
  to: string,
): SurveyDefinition {
  return rewriteElements(definition, registry, (element, markerProperty) =>
    withProse(element, markerProperty, (prose) =>
      prose.replaceAll(new RegExp(escape(marker(from)), 'gu'), marker(to)),
    ),
  ) as SurveyDefinition;
}

/** The marker properties an element's type declares, if it declares any. */
function markerPropertiesOf(
  element: SurveyDefinition,
  registry: MetadataRegistry,
): readonly string[] {
  const type = element['type'];
  return typeof type === 'string'
    ? registry
        .getChildCollections(type)
        .flatMap((collection) =>
          collection.markerProperty === undefined ? [] : [collection.markerProperty],
        )
    : [];
}

function rewriteElements(
  value: unknown,
  registry: MetadataRegistry,
  change: (element: SurveyDefinition, markerProperty: string) => SurveyDefinition,
): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => rewriteElements(item, registry, change));
    return items.some((item, at) => item !== value[at]) ? items : value;
  }
  if (!isDefinition(value)) {
    return value;
  }
  let output = value;
  for (const markerProperty of markerPropertiesOf(value, registry)) {
    output = change(output, markerProperty);
  }
  for (const [key, child] of Object.entries(output)) {
    const next = rewriteElements(child, registry, change);
    if (next !== child) {
      output = output === value ? { ...value } : output;
      output[key] = next;
    }
  }
  return output;
}

/** The same definition with one element's marker prose rewritten, language by language. */
function rewriteMarkerText(
  definition: SurveyDefinition,
  owner: string,
  markerProperty: string,
  change: (prose: string) => string,
): SurveyDefinition {
  return rewriteNamed(definition, owner, (element) =>
    withProse(element, markerProperty, change),
  );
}

function withProse(
  element: SurveyDefinition,
  markerProperty: string,
  change: (prose: string) => string,
): SurveyDefinition {
  const current = element[markerProperty];
  if (typeof current === 'string') {
    const next = change(current);
    return next === current ? element : { ...element, [markerProperty]: next };
  }
  if (!isLocalizedText(current)) {
    return element;
  }
  const entries: Record<string, string> = {};
  let touched = false;
  for (const [locale, text] of Object.entries(current)) {
    if (text === undefined) {
      continue;
    }
    const next = change(text);
    touched ||= next !== text;
    entries[locale] = next;
  }
  return touched ? { ...element, [markerProperty]: entries } : element;
}

function escape(text: string): string {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}
