import type { PropertyValue } from '../metadata/PropertyDescriptor.js';
import { getPropertyDefault } from '../metadata/PropertyDefaults.js';
import { StringDictionary } from '../strings/StringDictionary.js';
import { isLocalizedText, resolveLocalizedText } from './localizedText.js';
import type { LocaleScope } from './localizedText.js';
import type { UiStringKey } from '../strings/uiStrings.js';

/**
 * Base of every model object. Holds declared property values and — separately —
 * properties the registry does not know about.
 *
 * Unknown-property retention lives here rather than in individual types on purpose:
 * ADR-0002 rule 3 must be impossible to opt out of, so no subclass can drop them.
 */
export abstract class SurveyElement {
  readonly #values: Map<string, PropertyValue> = new Map();
  readonly #unknownProperties: Map<string, unknown> = new Map();
  #localeScope: LocaleScope = { locale: '', strings: new StringDictionary() };
  #isVisible = true;
  #isEnabled = true;

  /** Registered class name. Drives every registry lookup for this element. */
  abstract get type(): string;

  getPropertyValue(name: string): PropertyValue | undefined {
    return this.#values.get(name);
  }

  setPropertyValue(name: string, value: PropertyValue): void {
    this.#values.set(name, value);
  }

  hasPropertyValue(name: string): boolean {
    return this.#values.has(name);
  }

  /** Properties carried through round-trip verbatim because we do not understand them. */
  getUnknownProperties(): ReadonlyMap<string, unknown> {
    return this.#unknownProperties;
  }

  setUnknownProperty(name: string, value: unknown): void {
    this.#unknownProperties.set(name, value);
  }

  /**
   * Computed visibility.
   *
   * Not a stored property: it is derived from `visibleIf` by the logic engine, and is
   * deliberately absent from serialization — the definition records the *rule*, never
   * the rule's current answer.
   */
  get isVisible(): boolean {
    return this.#isVisible;
  }

  /** Set by the logic engine. Authors change visibility through `visibleIf`. */
  setVisibility(isVisible: boolean): void {
    this.#isVisible = isVisible;
  }

  /**
   * Computed enabled state, derived from `enableIf`. Like visibility, never
   * serialized: the definition holds the rule, not the rule's current answer.
   */
  get isEnabled(): boolean {
    return this.#isEnabled;
  }

  /** Set by the logic engine. Authors change this through `enableIf`. */
  setEnabled(isEnabled: boolean): void {
    this.#isEnabled = isEnabled;
  }

  /**
   * Children stored under a declared child collection.
   *
   * Keyed by the collection's JSON property because one element can hold several —
   * a survey has both `pages` and `calculatedValues`.
   */
  getChildren(_property: string): readonly SurveyElement[] {
    return [];
  }

  addChild(property: string, _child: SurveyElement): void {
    throw new Error(`"${this.type}" does not accept children under "${property}".`);
  }

  /**
   * A declared property's current value, falling back to its registered default.
   *
   * Public because reading a property *by name* is what a generic consumer needs — the
   * property grid the Creator generates from the registry has no typed accessor to
   * call. The typed getters below are the same lookup, narrowed.
   */
  getResolvedProperty(name: string): PropertyValue | undefined {
    return this.#values.has(name)
      ? this.#values.get(name)
      : getPropertyDefault(this, this.type, name);
  }

  /**
   * Which language this element's strings are read in — checklist J1.
   *
   * A shared, mutable holder rather than a copied value: one survey has one locale, and
   * every element in it has to see a switch at the same instant. Its own by default so a
   * detached element — one a test built, or a template not yet parented — still reads.
   */
  get localeScope(): LocaleScope {
    return this.#localeScope;
  }

  setLocaleScope(scope: LocaleScope): void {
    this.#localeScope = scope;
  }

  /**
   * One of the library's own strings, in this survey's language — checklist J2.
   *
   * On every element because every element has something to say: a validator's default
   * message, a matrix's "add a row", a question's character counter. The key is checked
   * against the catalogue at compile time, so a message that does not exist cannot be
   * asked for.
   *
   * `uiText` rather than `text` because a validator already has a `text` — the message
   * its *author* wrote. Two different things with one name on the same object would be
   * a trap rather than a convenience.
   */
  uiText(key: UiStringKey, ...params: readonly (string | number)[]): string {
    return this.#localeScope.strings.get(this.#localeScope.locale, key, ...params);
  }

  /**
   * A declared string property, in the current locale.
   *
   * **The resolution lives here, in one place.** Ninety-odd call sites read strings
   * through this method and not one of them had to learn that a title can be an object:
   * a property that was never authored per-locale holds a plain string and takes the
   * first branch, exactly as before.
   */
  protected getStringProperty(name: string): string {
    const value = this.getResolvedProperty(name);
    if (typeof value === 'string') {
      return value;
    }
    return isLocalizedText(value) ? resolveLocalizedText(value, this.#localeScope.locale) : '';
  }

  protected getBooleanProperty(name: string): boolean {
    return this.getResolvedProperty(name) === true;
  }

  protected getNumberProperty(name: string): number {
    const value = this.getResolvedProperty(name);
    return typeof value === 'number' ? value : 0;
  }
}
