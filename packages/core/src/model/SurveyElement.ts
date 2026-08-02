import type { PropertyValue } from '../metadata/PropertyDescriptor.js';

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

  protected getStringProperty(name: string): string {
    const value = this.#values.get(name);
    return typeof value === 'string' ? value : '';
  }

  protected getBooleanProperty(name: string): boolean {
    return this.#values.get(name) === true;
  }
}
