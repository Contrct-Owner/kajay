import { valuesAreEqual } from '../expressions/expressionValues.js';
import type { ItemValue } from '../model/ItemValue.js';
import { choiceListsMatch } from '../model/ItemValue.js';
import type { LogicRule } from './LogicRule.js';

/** How a carried-forward list relates to the source question's answer. */
export type CarryForwardMode = 'all' | 'selected' | 'unselected';

export interface CarryForwardSource {
  /** Choices currently offered by the source, or undefined when it is not a select. */
  readonly getSourceChoices: () => readonly ItemValue[] | undefined;
  readonly getSourceValue: () => unknown;
  readonly installProvider: (provider: () => readonly ItemValue[]) => void;
  readonly announce: () => void;
}

function selectedValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === null || value === undefined ? [] : [value];
}

/**
 * Derives one question's choices from another's.
 *
 * The derivation is installed as a **live provider**, not computed into a stored list.
 * That matters because two independent things move it: the source's *answer*, which
 * this rule depends on, and the visibility of individual source choices, which their
 * own `visibleIf` drives. A snapshot would be correct for the first and stale for the
 * second.
 *
 * The rule therefore exists only to notice when the derived list has changed as a
 * result of the answer, and say so — choice-visibility changes already announce
 * themselves through the element-state event.
 */
export function createCarryForwardRule(
  key: string,
  sourceName: string,
  mode: CarryForwardMode,
  source: CarryForwardSource,
): LogicRule {
  let announced: readonly ItemValue[] | undefined;

  const derive = (): readonly ItemValue[] => {
    const choices = source.getSourceChoices();
    if (choices === undefined) {
      return [];
    }
    if (mode === 'all') {
      return choices;
    }
    const answer = selectedValues(source.getSourceValue());
    const isPicked = (choice: ItemValue): boolean =>
      answer.some((selected) => valuesAreEqual(selected, choice.value));
    return mode === 'selected'
      ? choices.filter((choice) => isPicked(choice))
      : choices.filter((choice) => !isPicked(choice));
  };

  return {
    key,
    reads: [[{ kind: 'name', name: sourceName }]],
    run: () => {
      // Pointing at a question that has no choices is an authoring mistake; leaving
      // the authored list in place beats offering nothing.
      if (source.getSourceChoices() === undefined) {
        return;
      }
      source.installProvider(derive);

      const current = derive();
      if (announced === undefined || !choiceListsMatch(announced, current)) {
        announced = current;
        source.announce();
      }
    },
  };
}
