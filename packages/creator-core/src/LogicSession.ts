import { EventEmitter } from '@kajay/core';
import type { SurveyElement } from '@kajay/core';
import { printCondition } from './conditionTerms.js';
import type { Condition } from './conditionTerms.js';
import type { DesignSurface } from './DesignSurface.js';
import { collectLogicRules } from './logicRules.js';
import type { LogicActionKind, LogicRule } from './logicRules.js';

/** A rule a designer can add, and where adding it writes. */
export interface LogicRuleTemplate {
  readonly action: LogicActionKind;
  /** The property it writes, for a rule that lives on an element. */
  readonly property?: string;
  /** The registered type it creates, for a rule that lives in the trigger list. */
  readonly triggerType?: string;
}

/**
 * The rules a designer can add, and what each one writes.
 *
 * Element rules need something to attach to, so they are offered per *subject*; trigger
 * rules belong to the survey and are always available. The list is short because the
 * format's conditional properties are — this is the same five `logicRules` reads back.
 */
export const LOGIC_TEMPLATES: readonly LogicRuleTemplate[] = [
  { action: 'show', property: 'visibleIf' },
  { action: 'enable', property: 'enableIf' },
  { action: 'require', property: 'requiredIf' },
  { action: 'setValue', property: 'setValueIf' },
  { action: 'clearValue', property: 'resetValueIf' },
  { action: 'skip', triggerType: 'skip' },
  { action: 'complete', triggerType: 'complete' },
];

/**
 * Every rule in the survey, listed and editable — checklist M1.
 *
 * **Every edit goes through the surface**, so a condition built from dropdowns is undoable
 * exactly like a drag and reaches the definition through the same chokepoints: a property
 * rule is `setProperty`, a trigger rule is a child edit. Nothing here writes to the model
 * on its own, which is why the logic tab and the property grid can never disagree about
 * what a `visibleIf` says.
 *
 * The rules are **derived on every read** and there is no session state beyond the surface,
 * so this is a thin object on purpose — but it is still a session, because a view needs one
 * thing to subscribe to and because §N will want to configure what a host may edit here.
 */
export class LogicSession {
  readonly #surface: DesignSurface;
  readonly #unsubscribe: () => void;
  #version = 0;

  readonly onChanged: EventEmitter<number> = new EventEmitter();

  constructor(surface: DesignSurface) {
    this.#surface = surface;
    this.#unsubscribe = surface.onChanged.add(() => {
      this.#announce();
    });
  }

  get version(): number {
    return this.#version;
  }

  get rules(): readonly LogicRule[] {
    return collectLogicRules(this.#surface.survey, this.#surface.registry);
  }

  /** The elements a rule can be attached to, by name — what an "add" picker offers. */
  get subjects(): readonly string[] {
    return this.#surface.survey.pages.flatMap((page) => [
      page.name,
      ...page.elements.map((element) => element.name),
    ]);
  }

  /** The pages a `skip` rule can go to. */
  get pageNames(): readonly string[] {
    return this.#surface.survey.pages.map((page) => page.name);
  }

  /**
   * The choices of the question a term is testing, when it has any.
   *
   * What turns the value cell from a text box into a picker — and it is *derived*, so it
   * works for a host's own select type and stops working the moment carry-forward makes the
   * choices somebody else's. An empty list means "no opinion", never "no choices".
   */
  choicesFor(path: string): readonly string[] {
    const question = this.#surface.survey.getQuestionByName(path);
    const choices = question?.getChildren('choices') ?? [];
    return choices
      .map((choice) => choice.getPropertyValue('value'))
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map(String);
  }

  /** Writes a rule's condition from the builder. Says whether it took. */
  setCondition(rule: LogicRule, condition: Condition): boolean {
    return this.setConditionText(rule, printCondition(condition));
  }

  /**
   * Writes a rule's condition as text — what the fallback editor calls.
   *
   * **An emptied condition removes the rule**, because a `visibleIf` of `""` is not a rule
   * that always holds, it is the absence of one: canonical form elides it (ADR-0002), so
   * leaving the row on screen would show a rule the definition does not have.
   */
  setConditionText(rule: LogicRule, text: string): boolean {
    // One setter for both sites. A trigger is a registered element like any other, so
    // `setProperty` reaches it exactly as it reaches a question — which is what L2's
    // collection editor already relies on for a validator's `minValue`.
    return rule.site.kind === 'trigger'
      ? this.#surface.setProperty(rule.site.trigger, 'expression', text)
      : this.#surface.setProperty(rule.site.element, rule.site.property, text);
  }

  /** Writes the action's own argument: the value to set, the page to skip to. */
  setArgument(rule: LogicRule, argumentProperty: string, value: string): boolean {
    const target =
      rule.site.kind === 'trigger' ? rule.site.trigger : rule.site.element;
    return this.#surface.setProperty(target, argumentProperty, value);
  }

  /**
   * Removes a rule.
   *
   * A property rule is emptied and a trigger is deleted, which is the same act said two
   * ways: in both cases the definition stops carrying it.
   */
  removeRule(rule: LogicRule): boolean {
    if (rule.site.kind === 'trigger') {
      return this.#surface.removeChild(this.#surface.survey, 'triggers', rule.site.index);
    }
    return this.#surface.setProperty(rule.site.element, rule.site.property, '');
  }

  /**
   * Adds a rule, with a condition already in it.
   *
   * **Never an empty one.** A rule whose condition is `""` does not exist in the definition
   * — canonical form elides it — so adding one and writing nothing would leave a row on
   * screen that vanished on the next re-parse. The starter condition names the first
   * question it can find, which a designer then changes.
   */
  addRule(template: LogicRuleTemplate, subject: string): boolean {
    const starter = this.#starterCondition();
    if (template.triggerType !== undefined) {
      const added = this.#surface.addChild(this.#surface.survey, 'triggers', template.triggerType);
      const trigger = this.#surface.survey.getChildren('triggers').at(-1);
      return (
        added &&
        trigger !== undefined &&
        this.#surface.setProperty(trigger, 'expression', starter)
      );
    }
    const element = this.#find(subject);
    return (
      template.property !== undefined &&
      element !== undefined &&
      this.#surface.setProperty(element, template.property, starter)
    );
  }

  #starterCondition(): string {
    const first = this.#surface.survey.pages.flatMap((page) => page.elements)[0];
    return first === undefined ? "'' == ''" : `{${first.name}} notempty`;
  }

  #find(name: string): SurveyElement | undefined {
    for (const page of this.#surface.survey.pages) {
      if (page.name === name) {
        return page;
      }
      const found = page.elements.find((element) => element.name === name);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  /** Stops following the designer. A host that discards a session should call this. */
  dispose(): void {
    this.#unsubscribe();
  }

  #announce(): void {
    this.#version += 1;
    this.onChanged.emit(this.#version);
  }
}
