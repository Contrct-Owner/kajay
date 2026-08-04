import { createContext, useContext } from 'react';
import type { ComponentType, KeyboardEvent, PointerEvent, ReactElement, ReactNode } from 'react';

/**
 * The primitives a survey is drawn from — [ADR-0022](../../../docs/adr/0022-design-system-primitives.md).
 *
 * **The half of that ADR that was scheduled and never built.** `creator-react` has drawn
 * through its own map since its first commit; the renderer has not, and the ADR said so
 * plainly: converting twenty-odd renderers "is real work with real regression risk, and
 * pretending otherwise here is how it would get done badly. It is a row, sized and
 * scheduled." This is that row. Until it landed, a shadcn host got a Creator built from
 * their components and a *survey* built from ours, sitting in the same frame — the exact
 * "two design systems on one page" outcome the ADR exists to prevent.
 *
 * **A separate map from the Creator's, deliberately.** The two packages have different
 * audiences — a respondent never sees the Creator's chrome and a designer never fills in
 * the survey — and more practically, `@kajay/react` cannot import from `@kajay/creator-react`
 * without inverting the dependency direction the architecture check enforces. A host who
 * wants one object for both spreads theirs into both, which is what the reference
 * application does in four lines.
 *
 * The shape is the Creator's, because the whole point is that one adapter serves both:
 * `value`/`onValueChange`, `checked`/`onCheckedChange`, `className` passed through, and
 * Radix's conventions wherever Radix has settled one.
 */
export interface SurveyComponents {
  // `| undefined` explicitly, under `exactOptionalPropertyTypes`, so a host may build the
  // map conditionally — `{ Button: isFancy ? Fancy : undefined }` — and mean "use the
  // default" rather than being refused by the compiler.
  readonly Button?: ComponentType<SurveyButtonProps> | undefined;
}

/*
 * **Button first, and only Button so far.** Twenty-six of the forty-eight native controls
 * in this package are buttons, they are the most visually decisive thing a design system
 * owns, and every one of them is a plain action — so this is the conversion with the most
 * effect and the least behavioural risk.
 *
 * `Input`, `Textarea`, `Checkbox` and `Radio` are next and are deliberately *not* declared
 * here yet: a map entry nothing draws through is API a host can supply and watch do
 * nothing, which is worse than an absent one. They arrive with their conversions.
 *
 * The eight native `<select>`s are a separate decision. A shadcn Select is a button, a
 * portal and a listbox rather than a `<select>`, and this package's dropdown carries §C5
 * and §C6's lazy paging, its search and its "other" row — so by ADR-0022's own admission
 * rule ("a design system almost certainly already has it") it is not obviously a primitive
 * at all. That call wants evidence from the reference application, not an argument here.
 */

/**
 * Every button a survey draws: navigation, add and remove row, add panel, clear, and the
 * twenty-six others.
 *
 * **A substituted Button must spread its rest props onto a real `<button>`.** The ranking
 * question's rows *are* buttons, and their drag gesture arrives as `onPointerDown` and
 * friends from `useReorder`; a primitive that drops them silently breaks reordering, and
 * *silently* is the word — a spread bypasses excess-property checking, so nothing would
 * complain. That is why every one of them is named here rather than left to a wider type.
 */
export interface SurveyButtonProps {
  readonly type?: 'button' | 'submit';
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children?: ReactNode;
  readonly title?: string;
  readonly tabIndex?: 0;
  /**
   * G2's tab render mode draws its buttons as `tab`, inside a `tablist`.
   *
   * In the contract rather than left out because a primitive that dropped it would turn a
   * tab strip into a row of buttons for anybody using a screen reader — and the failure is
   * invisible on screen, which is the kind this interface exists to make impossible.
   */
  readonly role?: 'tab';
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-expanded'?: boolean | undefined;
  readonly 'aria-controls'?: string | undefined;
  readonly 'aria-selected'?: boolean | undefined;
  readonly 'aria-current'?: 'step' | 'page' | undefined;
  readonly 'aria-busy'?: boolean | undefined;
  /**
   * How an action says it may not be taken — E7.
   *
   * `aria-disabled`, never the HTML attribute: a disabled button leaves the tab order and
   * stops being announced, and a respondent reading a read-only survey still has to be
   * able to reach and hear it.
   */
  readonly 'aria-disabled'?: 'true' | undefined;
  readonly 'aria-roledescription'?: string;
  readonly 'data-reorder-item'?: '';
  readonly 'data-grabbed'?: 'true' | undefined;
  readonly 'data-dragged'?: 'true' | undefined;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
  readonly onBlur?: () => void;
}

function DefaultButton({
  type = 'button',
  children,
  ...rest
}: SurveyButtonProps): ReactElement {
  return (
    <button type={type === 'submit' ? 'submit' : 'button'} {...rest}>
      {children}
    </button>
  );
}

/**
 * The shipped defaults: native elements carrying whatever class names the caller passed,
 * which the stylesheet already styles.
 *
 * They render **exactly what the renderers rendered before this seam existed**, which is
 * what makes the two hundred and ninety browser tests and two hundred and nine end-to-end
 * scenarios the regression net for this change rather than work to be redone alongside it.
 * A test that goes red here is a real behaviour change.
 */
const DEFAULTS = { Button: DefaultButton };

const SurveyComponentsContext = createContext<SurveyComponents>({});

export interface SurveyComponentsProviderProps {
  readonly components: SurveyComponents | undefined;
  readonly children: ReactNode;
}

/** Supplies the host's primitives to every renderer below. */
export function SurveyComponentsProvider({
  components,
  children,
}: SurveyComponentsProviderProps): ReactElement {
  return (
    <SurveyComponentsContext.Provider value={components ?? {}}>
      {children}
    </SurveyComponentsContext.Provider>
  );
}

/**
 * Every primitive resolved to something drawable.
 *
 * Not `Required<SurveyComponents>`: that strips the optionality and leaves the `| undefined`
 * in place, which is not a valid JSX element type.
 */
export type ResolvedSurveyComponents = {
  readonly [Name in keyof SurveyComponents]-?: NonNullable<SurveyComponents[Name]>;
};

/** The primitives in force here: the host's where supplied, ours where not. */
export function useSurveyComponents(): ResolvedSurveyComponents {
  const supplied = useContext(SurveyComponentsContext);
  return { ...DEFAULTS, ...definedOnly(supplied) };
}

/**
 * An explicitly `undefined` entry means "use the default", not "draw nothing".
 *
 * A host building the map conditionally would otherwise blank the control rather than fall
 * back to ours — and this is also what makes the set *extensible*: adding a primitive in a
 * later version cannot break a host who supplied a full map, because there is no such thing
 * as a full map.
 */
function definedOnly(components: SurveyComponents): Partial<ResolvedSurveyComponents> {
  return Object.fromEntries(
    Object.entries(components).filter(([, value]) => value !== undefined),
  ) as Partial<ResolvedSurveyComponents>;
}
