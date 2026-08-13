import type { MetadataRegistry, SurveyDefinition } from '@kajay/core';

/**
 * A rename carried into every reference to the thing renamed — checklist K5, L1.
 *
 * **A name is written in two syntaxes**, and only one of them was ever followed. `{who}`
 * names a question outright; `{grid[0].size}`, `{plan.seats}` and `{row.size}` name
 * something *inside* one. A rewrite that followed the first and not the second left a
 * survey that still parses, still renders and silently stops working — which is the exact
 * failure the rename rewrite exists to prevent, one level down.
 *
 * **Qualified rather than textual**, deliberately. Rewriting every `.size` in every
 * expression would be shorter and would corrupt `{$profile.size}` — a host value with a
 * key of that name and nothing to do with the rename — so a tail is rewritten only under
 * the owner that actually holds the renamed child, or under the owner's record word
 * inside the owner itself.
 */

/** A rename that has been applied, old name to new. */
export type RenameMap = ReadonlyMap<string, string>;

/** `{owner.child}` and `{owner[0].child}`, wherever in the survey they are written. */
interface QualifiedRename {
  readonly owner: string;
  readonly from: string;
  readonly to: string;
}

/** `{row.child}`, which means the enclosing record and so is true only inside it. */
interface ScopedRename {
  readonly scope: string;
  readonly from: string;
  readonly to: string;
}

/** The same tree with every name and every reference to it rewritten. */
export function rewriteRenames(
  definition: SurveyDefinition,
  renames: RenameMap,
  registry: MetadataRegistry,
): SurveyDefinition {
  if (renames.size === 0) {
    return definition;
  }
  const qualified = qualifiedRenames(definition, renames, registry);
  return rewrite(definition, renames, registry, qualified, []) as SurveyDefinition;
}

/**
 * Every renamed child, paired with the owner a reference has to name to reach it.
 *
 * Found by asking the registry which collections a type declares rather than by knowing
 * which of them hold answers: a panel's `elements` are addressed by their bare names, so
 * `{panel1.who}` names nothing at all and rewriting it changes a reference that could
 * never have resolved. Being wrong in that direction costs nothing; missing a matrix
 * column costs a survey that quietly stops working.
 */
function qualifiedRenames(
  definition: SurveyDefinition,
  renames: RenameMap,
  registry: MetadataRegistry,
): readonly QualifiedRename[] {
  const found: QualifiedRename[] = [];
  forEachElement(definition, (element) => {
    const owner = nameOf(element);
    if (owner === undefined) {
      return;
    }
    for (const child of renamedChildrenOf(element, renames, registry)) {
      // The owner's *new* name: the root rewrite has already run over the same string by
      // the time this pattern is applied, so a renamed matrix is already called that.
      found.push({ owner: renames.get(owner) ?? owner, from: child, to: renames.get(child) ?? child });
    }
  });
  return found;
}

function renamedChildrenOf(
  element: SurveyDefinition,
  renames: RenameMap,
  registry: MetadataRegistry,
): readonly string[] {
  const type = element['type'];
  if (typeof type !== 'string') {
    return [];
  }
  return registry.getChildCollections(type).flatMap((collection) => {
    const children = element[collection.property];
    return Array.isArray(children)
      ? children.flatMap((child) => {
          const name = isDefinition(child) ? nameOf(child) : undefined;
          return name !== undefined && renames.has(name) ? [name] : [];
        })
      : [];
  });
}

function rewrite(
  value: unknown,
  renames: RenameMap,
  registry: MetadataRegistry,
  qualified: readonly QualifiedRename[],
  scoped: readonly ScopedRename[],
): unknown {
  if (typeof value === 'string') {
    return rewriteReferences(value, renames, qualified, scoped);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewrite(item, renames, registry, qualified, scoped));
  }
  if (!isDefinition(value)) {
    return value;
  }
  // A repeating type's own word reaches its children and nothing else, so it is added on
  // the way in and gone on the way out. `{row.size}` in a question on a page is not a
  // reference to somebody's matrix column.
  const within = [...scoped, ...scopedRenames(value, renames, registry)];
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] =
      key === 'name' && typeof child === 'string'
        ? (renames.get(child) ?? child)
        : rewrite(child, renames, registry, qualified, within);
  }
  return output;
}

function scopedRenames(
  element: SurveyDefinition,
  renames: RenameMap,
  registry: MetadataRegistry,
): readonly ScopedRename[] {
  const type = element['type'];
  const scope = typeof type === 'string' ? registry.getClass(type)?.recordScope : undefined;
  return scope === undefined
    ? []
    : renamedChildrenOf(element, renames, registry).map((from) => ({
        scope,
        from,
        to: renames.get(from) ?? from,
      }));
}

/**
 * Rewrites `{who}` to `{who2}`, and `{grid[0].size}` to `{grid[0].width}`, inside a string.
 *
 * **Every string, not only the ones the registry calls expressions.** `{who}` in a title,
 * in HTML content or in a validator's message is the same reference by the same syntax
 * (B6's text piping), and a rewrite that covered `visibleIf` but not the heading above it
 * would leave a copy that behaved correctly and read wrongly.
 *
 * The boundary matters in both syntaxes: `{who}` must not match inside `{whoever}`, and a
 * qualified tail is matched after a `{` or a `.` so that `{people[0].grid[0].size}` — a
 * matrix inside a repeating panel — is reached as readily as `{grid[0].size}`.
 */
function rewriteReferences(
  text: string,
  renames: RenameMap,
  qualified: readonly QualifiedRename[],
  scoped: readonly ScopedRename[],
): string {
  if (!text.includes('{')) {
    return text;
  }
  let output = text;
  for (const [from, to] of renames) {
    output = output.replaceAll(new RegExp(String.raw`\{${escape(from)}(?=[}.[])`, 'gu'), `{${to}`);
  }
  for (const { owner, from, to } of qualified) {
    const pattern = String.raw`(?<=[{.])${escape(owner)}((?:\[\d+\])?)\.${escape(from)}(?=[}.[])`;
    output = output.replaceAll(new RegExp(pattern, 'gu'), `${owner}$1.${to}`);
  }
  for (const { scope, from, to } of scoped) {
    const pattern = String.raw`\{${escape(scope)}\.${escape(from)}(?=[}.[])`;
    output = output.replaceAll(new RegExp(pattern, 'gu'), `{${scope}.${to}`);
  }
  return output;
}

function forEachElement(value: unknown, visit: (element: SurveyDefinition) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      forEachElement(item, visit);
    }
    return;
  }
  if (!isDefinition(value)) {
    return;
  }
  visit(value);
  for (const child of Object.values(value)) {
    forEachElement(child, visit);
  }
}

function nameOf(element: SurveyDefinition): string | undefined {
  const name = element['name'];
  return typeof name === 'string' ? name : undefined;
}

function isDefinition(value: unknown): value is SurveyDefinition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escape(name: string): string {
  return name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}
