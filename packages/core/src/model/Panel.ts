import { PageElement } from './PageElement.js';
import { Question } from './Question.js';
import type { SurveyElement } from './SurveyElement.js';
import type { ValueHost } from './ValueHost.js';

/**
 * Hands the value host to whichever kind of element this is.
 *
 * A free function rather than a `PageElement` method because only questions and panels
 * need one; forcing an empty implementation onto every future element type would be a
 * worse abstraction than one `instanceof`. Exported because a page propagates the same
 * way a panel does.
 */
export function attachHostToElement(element: PageElement, host: ValueHost): void {
  if (element instanceof Panel || element instanceof Question) {
    element.attachValueHost(host);
  }
}

/** Authored initial collapse state. `default` leaves the panel expanded. */
export type PanelState = 'default' | 'expanded' | 'collapsed';

/**
 * A group of elements inside a page, which may itself contain further panels.
 *
 * A panel holds no answer. Its whole job is structure: it groups elements so that one
 * `visibleIf` governs the group, and so a long page can be read in sections.
 *
 * Collapsing lives on the model rather than in the renderer because the definition
 * declares the starting state and the Creator has to edit it — a panel whose collapse
 * state existed only in React would be invisible to both.
 */
export class Panel extends PageElement {
  readonly #elements: PageElement[] = [];
  #valueHost: ValueHost | undefined;
  #isCollapsed: boolean | undefined;
  #announceCollapsed: ((isCollapsed: boolean) => void) | undefined;

  override get type(): string {
    return 'panel';
  }

  get description(): string {
    return this.getStringProperty('description');
  }

  set description(value: string) {
    this.setPropertyValue('description', value);
  }

  /** Authored starting state; `isCollapsed` is what the renderer reads. */
  get state(): PanelState {
    const state = this.getStringProperty('state');
    return state === 'collapsed' || state === 'expanded' ? state : 'default';
  }

  set state(value: PanelState) {
    this.setPropertyValue('state', value);
  }

  /**
   * Whether the panel is collapsed right now.
   *
   * Falls back to the authored `state` until someone actually toggles it, so a panel
   * whose definition says `collapsed` starts collapsed without the renderer having to
   * seed anything.
   */
  get isCollapsed(): boolean {
    return this.#isCollapsed ?? this.state === 'collapsed';
  }

  setCollapsed(isCollapsed: boolean): void {
    if (this.isCollapsed === isCollapsed) {
      return;
    }
    this.#isCollapsed = isCollapsed;
    this.#announceCollapsed?.(isCollapsed);
  }

  /** Installed by the survey so a toggle reaches the renderer's subscription. */
  setCollapseAnnouncer(announce: (isCollapsed: boolean) => void): void {
    this.#announceCollapsed = announce;
  }

  get elements(): readonly PageElement[] {
    return this.#elements;
  }

  /**
   * Elements a respondent can currently see.
   *
   * Collapsing is deliberately not filtered here: a collapsed panel still *has* its
   * elements, and hiding them is a rendering decision. Filtering them out of the model
   * would make a collapsed panel indistinguishable from a hidden one.
   */
  get visibleElements(): readonly PageElement[] {
    return this.#elements.filter((element) => element.isVisible);
  }

  override getChildren(property: string): readonly SurveyElement[] {
    return property === 'elements' ? this.#elements : [];
  }

  override addChild(property: string, child: SurveyElement): void {
    if (property !== 'elements') {
      throw new Error(`A panel does not accept children under "${property}".`);
    }
    if (!(child instanceof PageElement)) {
      throw new Error(`A panel accepts questions and panels; received "${child.type}".`);
    }
    this.#elements.push(child);
    if (this.#valueHost !== undefined) {
      attachHostToElement(child, this.#valueHost);
    }
  }

  /** Propagates the host to current and future children, so attach order is free. */
  attachValueHost(host: ValueHost): void {
    this.#valueHost = host;
    for (const element of this.#elements) {
      attachHostToElement(element, host);
    }
  }
}
