import type { PathSegment } from '../expressions/ExpressionNode.js';
import { asAnswerRecord } from './objectAnswers.js';
import { PageElement } from './PageElement.js';
import { RepeatingQuestion } from './RepeatingQuestion.js';
import type { SurveyElement } from './SurveyElement.js';

/** The scope word a template's expressions use for the panel they are in. */
const PANEL = 'panel';

/** Instances the respondent creates are numbered, so their keys are their positions. */
function panelIndex(key: string): number {
  return Math.trunc(Number(key));
}

function asPanels(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.map((panel) => asAnswerRecord(panel)) : [];
}

/** How a repeating panel is laid out: all at once, or one at a time. */
export type PanelRenderMode = 'list' | 'tab' | 'progress';

const RENDER_MODES: ReadonlySet<string> = new Set(['list', 'tab', 'progress']);

export function toPanelRenderMode(value: string): PanelRenderMode {
  return RENDER_MODES.has(value) ? (value as PanelRenderMode) : 'list';
}

/**
 * A group of questions asked again for each of several things — checklist G1.
 *
 * "Tell us about each of your children", "list your previous addresses". The answer is
 * an array of records, one per instance, exactly as a dynamic matrix stores its rows —
 * and for the same reason: the instances *are* the data, so how many there are survives
 * a save and resume with nothing stored beside the answers.
 *
 * What differs from a matrix is entirely in the drawing. A matrix puts one question per
 * column and repeats across; a panel puts a whole form in each instance and repeats
 * down. That is why `{panel.q}` and `{row.col}` are the same mechanism under two words:
 * both mean "this one", and which reads better depends on what the author is building.
 */
export class PanelDynamicQuestion extends RepeatingQuestion {
  readonly #template: PageElement[] = [];
  #currentIndex = 0;

  override get type(): string {
    return 'paneldynamic';
  }

  protected override get scopeName(): string {
    return PANEL;
  }

  /** The elements repeated for each instance, exactly as authored. */
  get templateElements(): readonly PageElement[] {
    return this.#template;
  }

  /** How many instances are on screen: what has been stored, or the minimum. */
  get panelCount(): number {
    return Math.max(asPanels(this.value).length, this.minPanelCount);
  }

  get minPanelCount(): number {
    return Math.max(this.getNumberProperty('minPanelCount'), 0);
  }

  /** 0 means no limit. */
  get maxPanelCount(): number {
    return this.getNumberProperty('maxPanelCount');
  }

  get allowAddPanel(): boolean {
    return this.getBooleanProperty('allowAddPanel');
  }

  get allowRemovePanel(): boolean {
    return this.getBooleanProperty('allowRemovePanel');
  }

  get addPanelText(): string {
    return this.getStringProperty('addPanelText');
  }

  get removePanelText(): string {
    return this.getStringProperty('removePanelText');
  }

  get confirmDelete(): boolean {
    return this.getBooleanProperty('confirmDelete');
  }

  get confirmDeleteText(): string {
    return this.getStringProperty('confirmDeleteText');
  }

  /** `list`, `tab` or `progress` — checklist G2. */
  get renderMode(): PanelRenderMode {
    return toPanelRenderMode(this.getStringProperty('renderMode'));
  }

  /** Whether the respondent sees one instance at a time. */
  get isPaged(): boolean {
    return this.renderMode !== 'list';
  }

  override get rowKeys(): readonly string[] {
    return Array.from({ length: this.panelCount }, (_unused, index) => String(index));
  }

  /** `panelTitleFormat` with `{0}` as the instance's number, or the question's title. */
  override rowTitle(rowKey: string): string {
    const number = String(panelIndex(rowKey) + 1);
    const format = this.getStringProperty('panelTitleFormat');
    return format.length > 0 ? format.replaceAll('{0}', number) : number;
  }

  /** `{people[0].name}` — an index, so `{panel.name}` in a template scopes to it. */
  protected override rowPath(rowKey: string): readonly PathSegment[] {
    return [
      { kind: 'name', name: this.name },
      { kind: 'index', index: panelIndex(rowKey) },
    ];
  }

  protected override readRow(rowKey: string): Readonly<Record<string, unknown>> {
    return asPanels(this.value)[panelIndex(rowKey)] ?? {};
  }

  protected override writeRow(rowKey: string, next: Record<string, unknown> | undefined): void {
    const index = panelIndex(rowKey);
    const panels = [...asPanels(this.value)];
    while (panels.length <= index) {
      panels.push({});
    }
    panels[index] = next ?? {};
    this.value = panels;
  }

  /** The elements of one instance: whole panels included, not just the questions. */
  elementsFor(rowKey: string): readonly PageElement[] {
    return this.instancesOf('panel', rowKey, this.#template);
  }

  protected override rowInstances(rowKey: string): readonly PageElement[] {
    return this.elementsFor(rowKey);
  }

  /**
   * Which instance the respondent is looking at, when they see one at a time.
   *
   * Clamped on read rather than on write: instances come and go, and a stored index
   * pointing past the end would otherwise show an empty panel until something happened
   * to correct it.
   */
  get currentIndex(): number {
    return Math.min(Math.max(this.#currentIndex, 0), Math.max(this.panelCount - 1, 0));
  }

  setCurrentIndex(index: number): void {
    this.#currentIndex = index;
  }

  /** The instances to draw: all of them, or the one being looked at. */
  get visiblePanelKeys(): readonly string[] {
    if (!this.isPaged) {
      return this.visibleRowKeys;
    }
    const current = this.rowKeys[this.currentIndex];
    return current === undefined ? [] : [current];
  }

  get canAddPanel(): boolean {
    return this.allowAddPanel && (this.maxPanelCount <= 0 || this.panelCount < this.maxPanelCount);
  }

  get canRemovePanel(): boolean {
    return this.allowRemovePanel && this.panelCount > this.minPanelCount;
  }

  /**
   * Adds an instance and moves to it.
   *
   * Moving is the point when instances are paged: adding one the respondent then has to
   * navigate to is a control that appears to do nothing.
   */
  addPanel(): void {
    if (!this.canAddPanel) {
      return;
    }
    const panels = [...asPanels(this.value)];
    while (panels.length < this.panelCount) {
      panels.push({});
    }
    panels.push({ ...asAnswerRecord(this.getPropertyValue('defaultPanelValue')) });
    this.value = panels;
    this.#currentIndex = panels.length - 1;
    this.announceRecords(String(panels.length - 1), 'added');
  }

  /**
   * Removes one instance, closing the gap, exactly as a dynamic matrix removes a row.
   *
   * The answers move with the instances — each reads its record live, by index — so
   * rebuilding is hygiene rather than correctness: it keeps the graph free of rules for
   * an instance that no longer exists. Nothing observable comes of that, so no test pins
   * it and a mutation removing the call survives; without it the stale rules accumulate
   * one set per removal for the life of the survey.
   */
  removePanel(rowKey: string): void {
    const index = panelIndex(rowKey);
    if (!this.canRemovePanel || index < 0 || index >= this.panelCount) {
      return;
    }
    const panels = [...asPanels(this.value)];
    while (panels.length < this.panelCount) {
      panels.push({});
    }
    panels.splice(index, 1);
    this.value = panels.length > 0 ? panels : undefined;
    this.#currentIndex = Math.min(this.#currentIndex, Math.max(panels.length - 1, 0));
    this.announceRecords(rowKey, 'removed');
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'templateElements' ? this.#template : super.getChildren(property);
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'templateElements') {
      super.addChild(property, child);
      return;
    }
    if (!(child instanceof PageElement)) {
      throw new Error(`templateElements accepts questions and panels; received "${child.type}".`);
    }
    this.#template.push(child);
  }
}
