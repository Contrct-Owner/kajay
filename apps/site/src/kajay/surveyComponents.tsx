import type {
  SurveyButtonProps,
  SurveyChoiceProps,
  SurveyComponents,
  SurveyInputProps,
  SurveyTextareaProps,
} from '@kajay/react';
import type { ReactElement } from 'react';
import { Button as ShadcnButton } from '@/components/ui/button';
import { Checkbox as ShadcnCheckbox } from '@/components/ui/checkbox';
import { Input as ShadcnInput } from '@/components/ui/input';
import { Textarea as ShadcnTextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * The *survey* drawn with this application's design system — checklist P2.
 *
 * The companion to `creatorComponents.tsx`, and the reason there are two files rather than
 * one: `@kajay/react` and `@kajay/creator-react` each own a map, because the renderer
 * cannot import the Creator without inverting the dependency direction. From here that
 * costs one extra object literal and buys a survey and a designer that look like the same
 * product.
 *
 * Every component below is the same `src/components/ui/` source the site's own pages use.
 * Nothing is written twice.
 */

function Button({ children, ...props }: SurveyButtonProps): ReactElement {
  return <ShadcnButton {...props}>{children}</ShadcnButton>;
}

function Input({ onValueChange, ...props }: SurveyInputProps): ReactElement {
  return (
    <ShadcnInput
      {...props}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
    />
  );
}

function Textarea({ onValueChange, ...props }: SurveyTextareaProps): ReactElement {
  return (
    <ShadcnTextarea
      {...props}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
    />
  );
}

/**
 * Radix's Checkbox is a button with a `data-state`, not an `<input>`.
 *
 * Which means `reselect` is not merely ignorable here — it is *meaningless*: the whole
 * reason the flag exists is that a native radio raises no change event when the chosen
 * option is picked again, and a component that is not a radio has no such gap. Discarding
 * it explicitly rather than spreading it on is the difference between a considered
 * decision and an unknown attribute in the DOM.
 */
function Checkbox({
  onCheckedChange,
  reselect: _reselect,
  value: _value,
  name: _name,
  ...props
}: SurveyChoiceProps): ReactElement {
  return <ShadcnCheckbox {...props} onCheckedChange={onCheckedChange} />;
}

/**
 * **The one primitive this design system cannot re-export**, and the evidence behind
 * [ADR-0022](../../../../docs/adr/0022-design-system-primitives.md)'s 2026-08-04 amendment.
 *
 * shadcn's radio is `RadioGroupItem`, which only works inside a `RadioGroup` owning the
 * value and the roving focus — a *container*. Kajay draws each choice independently,
 * because the choice list is built from a model that also serves matrices, image pickers
 * and ratings, where the "group" is a table row or a scale rather than a component. A
 * matrix's radio group spans several `<td>`s inside a `<tr>`, and there is no legal element
 * to wrap them in.
 *
 * So this is written rather than re-exported: a native input carrying the same Tailwind
 * classes this application's own `RadioGroupItem` uses. **A dozen lines** — which is the
 * whole of what the amendment claims the exception costs, sitting here so the claim is
 * checkable rather than asserted.
 */
function Radio({
  onCheckedChange,
  reselect: _reselect,
  ...props
}: SurveyChoiceProps): ReactElement {
  return (
    <input
      type="radio"
      className={cn(
        'border-input text-primary size-4 shrink-0 rounded-full border shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.className,
      )}
      {...props}
      onChange={onCheckedChange}
    />
  );
}

export const KAJAY_SURVEY_COMPONENTS: SurveyComponents = {
  Button,
  Input,
  Textarea,
  Checkbox,
  Radio,
};
