import { conditionOf } from './conditionTerms.js';
import type { Condition } from './conditionTerms.js';
import type { MetadataRegistry, Survey, SurveyElement } from '@kajay/core';

/**
 * Every conditional rule in a survey, wherever it is written — checklist M1.
 *
 * **A rule is one action with one condition, and it is exactly one place in the
 * definition.** `visibleIf` on a question is a rule; a `skip` trigger is a rule. There is
 * no grouping by shared condition, and that is a decision rather than an omission: two
 * conditions that mean the same thing but are spelled differently would not group, and
 * editing a group would quietly edit several properties at once — a much larger promise
 * than a logic tab should be making. One row, one property.
 *
 * The list is **derived on every read**, like §M4's translation table and for the same
 * reason: a question deleted on the canvas takes its rules with it, and there is no second
 * list of logic to fall out of step with the survey.
 */

/** What a rule does when its condition holds. */
export type LogicActionKind =
  | 'show'
  | 'enable'
  | 'require'
  | 'setValue'
  | 'clearValue'
  | 'skip'
  | 'complete'
  | 'copyValue'
  | 'runExpression';

/** Where a rule is written: a property on an element, or a trigger on the survey. */
export type LogicSite =
  | { readonly kind: 'property'; readonly element: SurveyElement; readonly property: string }
  | { readonly kind: 'trigger'; readonly trigger: SurveyElement; readonly index: number };

export interface LogicRule {
  /**
   * Stable identity, and what a view keys on.
   *
   * An element's rules are keyed by name and property, so they survive a re-parse. A
   * **trigger is keyed by its position**, because a trigger has no name — which is worth
   * stating rather than hiding: reordering the trigger list renumbers them, and the logic
   * tab offers no reordering for exactly that reason.
   */
  readonly id: string;
  /** What the rule acts on, in words a designer recognises. */
  readonly subject: string;
  readonly action: LogicActionKind;
  /** The action's own argument: the value to set, the page to skip to. Empty when none. */
  readonly argument: string;
  /** The condition as authored. The one thing that always round-trips. */
  readonly conditionText: string;
  /** The condition as terms, or `undefined` when the builder cannot say it. */
  readonly condition: Condition | undefined;
  readonly site: LogicSite;
}

/**
 * The element properties that carry a condition, and what setting one *does*.
 *
 * `defaultValueExpression` is deliberately absent. It has no condition — it is a value,
 * computed always rather than when something holds — so it is not a rule, and the property
 * grid is where it belongs. Listing it here would put a row in the logic tab with an empty
 * condition column that could never be filled in.
 */
const CONDITIONAL_PROPERTIES: readonly (readonly [string, LogicActionKind, string])[] = [
  ['visibleIf', 'show', ''],
  ['enableIf', 'enable', ''],
  ['requiredIf', 'require', ''],
  ['setValueIf', 'setValue', 'setValueExpression'],
  ['resetValueIf', 'clearValue', ''],
];

/** What each trigger type does, and which of its properties is the argument. */
const TRIGGER_ACTIONS: ReadonlyMap<string, readonly [LogicActionKind, string]> = new Map([
  ['skip', ['skip', 'gotoName']],
  ['complete', ['complete', '']],
  ['setvalue', ['setValue', 'setToName']],
  ['copyvalue', ['copyValue', 'setToName']],
  ['runexpression', ['runExpression', 'setToName']],
]);

/** Every rule in the survey, in the order they are authored. */
export function collectLogicRules(
  survey: Survey,
  registry: MetadataRegistry,
): readonly LogicRule[] {
  return [...elementRules(survey, registry), ...triggerRules(survey)];
}

function elementRules(survey: Survey, registry: MetadataRegistry): readonly LogicRule[] {
  const rules: LogicRule[] = [];
  for (const element of walk(survey, registry)) {
    const name = nameOf(element);
    for (const [property, action, argumentProperty] of CONDITIONAL_PROPERTIES) {
      const text = stringProperty(element, property);
      if (text.length === 0) {
        continue;
      }
      rules.push({
        id: `${name}:${property}`,
        subject: name,
        action,
        argument: argumentProperty.length === 0 ? '' : stringProperty(element, argumentProperty),
        conditionText: text,
        condition: conditionOf(text),
        site: { kind: 'property', element, property },
      });
    }
  }
  return rules;
}

function triggerRules(survey: Survey): readonly LogicRule[] {
  return survey.getChildren('triggers').map((trigger, index) => {
    const [action, argumentProperty] = TRIGGER_ACTIONS.get(trigger.type) ?? ['complete', ''];
    const text = stringProperty(trigger, 'expression');
    return {
      id: `trigger:${String(index)}`,
      subject: 'survey',
      action,
      argument: argumentProperty.length === 0 ? '' : stringProperty(trigger, argumentProperty),
      conditionText: text,
      condition: conditionOf(text),
      site: { kind: 'trigger' as const, trigger, index },
    };
  });
}

/**
 * Every element that can carry a rule: the survey, its pages, and everything on them.
 *
 * Walked through the registry's child collections rather than through `pages` and
 * `elements` by name, so a rule on a matrix column or inside a host's own container type is
 * found for the same reason M4's translation table finds a string there.
 *
 * **The triggers are walked into like anything else**, and produce nothing. A first version
 * skipped them, on the theory that their `expression` would be listed twice; a mutant
 * proved that guard could not fail, because a trigger declares none of the conditional
 * properties above. It was removed rather than kept — logic no test can reach is logic
 * nobody has checked, which is E7's lesson and now M1's.
 */
function walk(root: SurveyElement, registry: MetadataRegistry): readonly SurveyElement[] {
  const found: SurveyElement[] = [root];
  for (const collection of registry.getChildCollections(root.type)) {
    for (const child of root.getChildren(collection.property)) {
      found.push(...walk(child, registry));
    }
  }
  return found;
}

function nameOf(element: SurveyElement): string {
  const name = element.getPropertyValue('name');
  return typeof name === 'string' && name.length > 0 ? name : element.type;
}

function stringProperty(element: SurveyElement, name: string): string {
  const value = element.getResolvedProperty(name);
  return typeof value === 'string' ? value : '';
}
