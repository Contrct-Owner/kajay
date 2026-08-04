import { createContext, useContext } from 'react';
import type {
  ComponentType,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
} from 'react';

/**
 * A button. Anything a designer presses.
 *
 * The props are the shape shadcn/ui, ReUI and Radix already use, so an adapter is a
 * re-export rather than a translation layer. `className` is passed through on every
 * primitive so a Tailwind host can style without replacing.
 */
export interface CreatorButtonProps {
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly className?: string;
  readonly title?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-current'?: 'page' | undefined;
  readonly 'aria-roledescription'?: string;
  readonly 'data-testid'?: string;
  readonly 'data-grabbed'?: 'true' | undefined;
  readonly onClick?: () => void;
  /**
   * Pointer and key handlers, because K2's drag handle is a button.
   *
   * **A substituted primitive must forward these.** The default does, and a host whose
   * Button spreads its props onto a `<button>` — which is what a design-system button
   * is — gets them for free. One that does not silently breaks dragging, and *silently*
   * is the word: a spread bypasses excess-property checking, so the first version of
   * this interface dropped every one of these handlers and the compiler said nothing.
   * That is the whole reason they are named here rather than left to a wider type.
   */
  readonly onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  readonly children?: ReactNode;
}

/** A single-line text field. `value`/`onValueChange`, not a raw change event. */
export interface CreatorInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly id?: string;
  readonly type?: 'text' | 'search';
  readonly 'aria-label'?: string;
  /** Points at the hint under a property-grid row — L1. */
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-invalid'?: boolean | undefined;
  /**
   * A value for reading rather than changing — checklist L3.
   *
   * `readOnly`, never `disabled`, which is [E7](../../react/src/readOnly.ts)'s rule and
   * for its reasons: a disabled field drops out of the tab order and stops being readable,
   * and a designer looking at a property they may not change still has to be able to see
   * what it says.
   */
  readonly readOnly?: boolean;
  readonly 'data-testid'?: string | undefined;
  /**
   * The combobox attributes, because L2's expression field is one.
   *
   * **A substituted primitive must forward these**, exactly as it must forward the drag
   * handlers above — and for a sharper reason: the *behaviour* is ours (the token model,
   * the keyboard grammar, the live list), and all the primitive is asked to do is put six
   * attributes and one handler on the element it renders. A host whose Input spreads its
   * props onto an `<input>` gets that for free; one that does not leaves a designer with a
   * suggestion list no screen reader can see.
   */
  readonly role?: 'combobox';
  readonly 'aria-expanded'?: boolean | undefined;
  readonly 'aria-controls'?: string | undefined;
  readonly 'aria-activedescendant'?: string | undefined;
  readonly 'aria-autocomplete'?: 'list' | undefined;
  readonly autoComplete?: 'off';
  readonly onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** L1's `name` row commits on blur; see `PropertyCommit`. */
  readonly onBlur?: () => void;
}

/**
 * A multi-line text field.
 *
 * The fifth primitive. L2's fast entry is the case that needs it — a choice list edited as
 * one item per line is not something a single-line field can be — and §M's JSON and theme
 * tabs are the next two. `value`/`onValueChange`, mirroring the input, so the two are one
 * thing to adapt rather than two.
 */
export interface CreatorTextareaProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly rows?: number;
  readonly spellCheck?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-invalid'?: boolean | undefined;
  readonly 'data-testid'?: string;
  readonly onBlur?: () => void;
}

/** One choice in a {@link CreatorSelectProps}. */
export interface CreatorSelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * A picker with a fixed set of choices. `value`/`onValueChange`, like the input.
 *
 * The third primitive, and it earned its place the way ADR-0022 asks: K5 has to let a
 * designer change a question's type, and there is no way to draw that out of a button
 * and a text field. `{ value, label }` rather than bare strings because a select is
 * exactly the control where the two come apart — `radiogroup` is a type name, not
 * something to show somebody.
 */
export interface CreatorSelectProps {
  readonly value: string;
  readonly options: readonly CreatorSelectOption[];
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  /**
   * Needed because §L4's replaced editors are built out of these.
   *
   * A grid row's `<label>` points at an id, and a host's own editor has to be able to put
   * it on whatever it renders — a select with no id is a field with no label attached to
   * it. The demo's `titleLocation` picker found this the first time it was written.
   */
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'data-testid'?: string;
}

/**
 * A single on/off control.
 *
 * The fourth primitive, and it earns its place on ADR-0022's terms exactly as `Select`
 * did: a property grid generated from the registry is largely booleans — `isRequired`,
 * `readOnly`, `startWithNewLine`, `autoGrow` — and there is no way to draw a checkbox out
 * of a button, a text field and a picker. A two-option select would be the alternative,
 * and it is worse for a pointer and worse again for a screen reader, which would announce
 * a yes/no question where the control is a switch.
 *
 * `checked`/`onCheckedChange` rather than `value`, because that is the shape shadcn/ui,
 * Radix and ReUI already use and an adapter should stay a re-export.
 */
export interface CreatorCheckboxProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string | undefined;
  /**
   * How a checkbox says it may not be changed — checklist L3.
   *
   * `aria-disabled` because ARIA gives a `checkbox` no read-only state that a native
   * checkbox honours, and E7 already worked out that this is the least-bad thing to say:
   * the control keeps its place in the tab order and stays announced, and what it gives up
   * is the claim that it can be operated.
   */
  readonly 'aria-disabled'?: 'true' | undefined;
  readonly 'data-testid'?: string;
}

/**
 * The primitives the Creator draws itself out of — [ADR-0022](../../../docs/adr/0022-design-system-primitives.md).
 *
 * **Partial, and that is load-bearing.** A host may replace one thing and leave the
 * rest; there is no such thing as a complete map, which is what lets a later version
 * add a primitive without breaking anyone who supplied one.
 *
 * The set stays small on purpose. A primitive earns its place only if the Creator needs
 * it in more than one place *and* a design system almost certainly already has it —
 * twelve components a host can adapt in an afternoon is a seam people use, forty is a
 * seam nobody finishes. Everything else is ours to build out of these.
 */
export interface CreatorComponents {
  // `| undefined` explicitly, under `exactOptionalPropertyTypes`, so a host may build
  // the map conditionally — `{ Button: isFancy ? Fancy : undefined }` — and mean "use
  // the default" rather than being refused by the compiler. Without it `stripUndefined`
  // below would be defending against something the types made unreachable, and dead
  // defensive code is worse than none.
  readonly Button?: ComponentType<CreatorButtonProps> | undefined;
  readonly Input?: ComponentType<CreatorInputProps> | undefined;
  readonly Select?: ComponentType<CreatorSelectProps> | undefined;
  readonly Checkbox?: ComponentType<CreatorCheckboxProps> | undefined;
  readonly Textarea?: ComponentType<CreatorTextareaProps> | undefined;
}

/**
 * The shipped defaults: native elements with the class names the stylesheet already
 * styles.
 *
 * They exist so nothing has to be supplied, and so the token contract stays meaningful
 * for hosts who want the shipped look. They are also what the accessibility sweep
 * covers — a host who substitutes a primitive owns that primitive's behaviour, and the
 * prop documentation above says what each one must do.
 */
function DefaultButton({
  type = 'button',
  className,
  children,
  onClick,
  ...rest
}: CreatorButtonProps): ReactElement {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      className={className}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

function DefaultInput({
  value,
  onValueChange,
  type = 'text',
  className,
  ...rest
}: CreatorInputProps): ReactElement {
  return (
    <input
      type={type}
      className={className}
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...rest}
    />
  );
}

function DefaultSelect({
  value,
  options,
  onValueChange,
  className,
  ...rest
}: CreatorSelectProps): ReactElement {
  return (
    <select
      className={className}
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DefaultCheckbox({
  checked,
  onCheckedChange,
  className,
  ...rest
}: CreatorCheckboxProps): ReactElement {
  return (
    <input
      type="checkbox"
      className={className}
      checked={checked}
      onChange={(event) => {
        onCheckedChange(event.target.checked);
      }}
      {...rest}
    />
  );
}

function DefaultTextarea({
  value,
  onValueChange,
  className,
  ...rest
}: CreatorTextareaProps): ReactElement {
  return (
    <textarea
      className={className}
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...rest}
    />
  );
}

const DEFAULTS = {
  Button: DefaultButton,
  Input: DefaultInput,
  Select: DefaultSelect,
  Checkbox: DefaultCheckbox,
  Textarea: DefaultTextarea,
};

const CreatorComponentsContext = createContext<CreatorComponents>({});

export interface CreatorComponentsProviderProps {
  readonly components: CreatorComponents | undefined;
  readonly children: ReactNode;
}

/**
 * Supplies the host's primitives to everything below.
 *
 * A context rather than a prop threaded through every piece, because a primitive map is
 * a fact about the *application* rather than about any one panel — and because
 * [ADR-0021](../../../docs/adr/0021-creator-composition.md)'s "no hidden context" rule
 * is about the *model*, which is still passed explicitly. A piece rendered with no
 * provider anywhere gets the defaults and works.
 */
export function CreatorComponentsProvider({
  components,
  children,
}: CreatorComponentsProviderProps): ReactElement {
  return (
    <CreatorComponentsContext.Provider value={components ?? {}}>
      {children}
    </CreatorComponentsContext.Provider>
  );
}

/**
 * Every primitive resolved to something drawable.
 *
 * Not `Required<CreatorComponents>`: that strips the optionality and leaves the
 * `| undefined` in place, which is not a valid JSX element type — the compiler catches
 * it, and the message is worth the extra line here.
 */
export type ResolvedCreatorComponents = {
  readonly [Name in keyof CreatorComponents]-?: NonNullable<CreatorComponents[Name]>;
};

/** The primitives in force here: the host's where supplied, ours where not. */
export function useCreatorComponents(): ResolvedCreatorComponents {
  const supplied = useContext(CreatorComponentsContext);
  return { ...DEFAULTS, ...definedOnly(supplied) };
}

/**
 * An explicitly `undefined` entry means "use the default", not "draw nothing".
 *
 * A host building the map conditionally — `{ Button: isFancy ? Fancy : undefined }` —
 * would otherwise blank the button rather than fall back to ours.
 *
 * The assertion is what the filter above it makes true: `Object.fromEntries` returns
 * `Record<string, unknown>` whatever went in, so the narrowing has to be stated. It is
 * the one place in this file where the compiler is told something rather than shown it.
 */
function definedOnly(components: CreatorComponents): Partial<ResolvedCreatorComponents> {
  return Object.fromEntries(
    Object.entries(components).filter(([, value]) => value !== undefined),
  ) as Partial<ResolvedCreatorComponents>;
}
