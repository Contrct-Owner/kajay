import { createContext, useContext } from 'react';
import type {
  ComponentType,
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from 'react';

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
  readonly Input?: ComponentType<SurveyInputProps> | undefined;
  readonly Textarea?: ComponentType<SurveyTextareaProps> | undefined;
  readonly Checkbox?: ComponentType<SurveyChoiceProps> | undefined;
  readonly Radio?: ComponentType<SurveyChoiceProps> | undefined;
}

/*
 * **The five that earned their place.** Twenty-six of the forty-eight native controls
 * in this package are buttons, they are the most visually decisive thing a design system
 * owns, and every one of them is a plain action — so this is the conversion with the most
 * effect and the least behavioural risk.
 *
 * `Input`, `Textarea`, `Checkbox` and `Radio` followed, and between them they account for
 * every remaining control a design system actually ships. Each was declared only once
 * something drew through it: a map entry nothing uses is API a host can supply and watch do
 * nothing, which is worse than an absent one.
 *
 * **The file input stays native**, deliberately. `type="file"` has no value to hand a
 * design system's Input — it carries a `FileList` and an `onChange` nobody's `Input`
 * signature accepts — and §H1's drop zone is ours to draw out of the primitives anyway.
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

/**
 * A single-line answer, and the filter box above a long choice list.
 *
 * `type` carries §C1's eleven HTML input types through unchanged, because a `date` question
 * and a `number` question differ by exactly this and a design system's Input almost always
 * forwards it to the element underneath.
 */
export interface SurveyInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly type?: string;
  readonly id?: string;
  readonly className?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /**
   * E7's rule: shown and readable, never `disabled`.
   *
   * Native, because this is the control HTML defines `readonly` for — the value stays
   * selectable, focusable and announced, and only editing is refused.
   */
  readonly readOnly?: boolean;
  readonly required?: boolean;
  /** §C1's bounds. Strings because that is what the attributes take. */
  readonly min?: string;
  readonly max?: string;
  readonly step?: number;
  /** §C11 sizes a field in characters when the item asks for it. */
  readonly size?: number;
  readonly 'aria-required'?: boolean | undefined;
  readonly 'aria-invalid'?: boolean | undefined;
  readonly 'aria-describedby'?: string | undefined;
}

/**
 * A multi-line answer — §C2's comment, and the long-text fallback.
 *
 * **`ref` is part of the contract**, which no other primitive needs. §C2's auto-grow
 * measures the element's real scroll height and writes its height back; there is no way to
 * do that without the element. A substituted Textarea that does not forward its ref leaves
 * auto-grow silently doing nothing — the box simply never grows, and nothing errors.
 */
export interface SurveyTextareaProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly ref?: Ref<HTMLTextAreaElement>;
  readonly id?: string;
  readonly className?: string;
  readonly placeholder?: string;
  readonly rows?: number;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  /** How §C2 turns off resizing when the author said not to. */
  readonly style?: CSSProperties | undefined;
  readonly 'aria-required'?: boolean | undefined;
  readonly 'aria-invalid'?: boolean | undefined;
  readonly 'aria-describedby'?: string | undefined;
}

/**
 * One choice in a list — a checkbox or a radio.
 *
 * **One interface, two entries in the map**, because the *props* are identical and the
 * components are not: a design system ships `Checkbox` and `RadioGroupItem` as different
 * things with different keyboard behaviour, and folding them into one entry with a `type`
 * prop would hand every host the branch we had just refused to write.
 *
 * `name` is what makes a native radio group a group, so it stays in the contract even
 * though a Radix-based substitute ignores it and groups by its own container.
 */
export interface SurveyChoiceProps {
  readonly checked: boolean;
  readonly onCheckedChange: () => void;
  readonly value?: string;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  /**
   * How a checkbox says it may not be changed — E7.
   *
   * A checkbox carries the state itself; a radio cannot, because ARIA does not define
   * `aria-readonly` on `radio` — a single-select group says it on the `radiogroup` around
   * them instead, which is why this is absent on radios rather than forgotten.
   */
  readonly 'aria-readonly'?: 'true' | undefined;
  /**
   * E7's answer where ARIA gives a control no read-only state at all.
   *
   * A radio has none, and neither does the `group` a matrix's fieldset is — so a read-only
   * matrix says it here, once per cell. Unlike the HTML attribute it leaves the control
   * focusable and announced, which is the whole of E7's point.
   */
  readonly 'aria-disabled'?: 'true' | undefined;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-invalid'?: boolean | undefined;
  readonly 'aria-describedby'?: string | undefined;
  /**
   * Whether picking the already-chosen option counts as choosing it — §C8 and §C10.
   *
   * **A native radio fires no change event for that**, and re-picking is exactly how a
   * respondent takes back a rating or an image choice. The default therefore listens on
   * click instead when this is set, which is a real behavioural difference and not a
   * styling hint — a substituted primitive that ignores it leaves a respondent unable to
   * clear an answer, with nothing on screen to suggest why.
   *
   * It is in the contract rather than solved by always listening on click because for
   * every other choice in the library `onChange` is the right event, and a library that
   * quietly changed which event fires would be harder to reason about than one that says
   * which it means.
   */
  readonly reselect?: boolean;
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
function DefaultInput({ value, onValueChange, ...rest }: SurveyInputProps): ReactElement {
  return (
    <input
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...rest}
    />
  );
}

function DefaultTextarea({ value, onValueChange, ...rest }: SurveyTextareaProps): ReactElement {
  return (
    <textarea
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...rest}
    />
  );
}

/** React insists a controlled input have a change handler; `reselect` reports on click. */
function noChange(): void {
  /* handled by onClick, which also covers re-selecting the same option */
}

/**
 * Checkbox and radio differ by one attribute here and by a whole keyboard contract in a
 * design system, which is exactly why they are two entries in the map and one factory here.
 */
function choiceOfType(type: 'checkbox' | 'radio') {
  return function DefaultChoice({
    checked,
    onCheckedChange,
    ...rest
  }: SurveyChoiceProps): ReactElement {
    const { reselect, ...attributes } = rest;
    return (
      <input
        type={type}
        checked={checked}
        // Click rather than change when `reselect` is set, so re-picking the option that
        // is already chosen still reports — see the prop's own note.
        {...(reselect === true
          ? { onClick: onCheckedChange, onChange: noChange }
          : { onChange: onCheckedChange })}
        {...attributes}
      />
    );
  };
}

const DEFAULTS = {
  Button: DefaultButton,
  Input: DefaultInput,
  Textarea: DefaultTextarea,
  Checkbox: choiceOfType('checkbox'),
  Radio: choiceOfType('radio'),
};

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
