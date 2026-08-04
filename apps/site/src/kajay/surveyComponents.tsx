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
 * **The one that stayed native, and the finding.**
 *
 * shadcn's radio is `RadioGroupItem` — an item that only works inside a `RadioGroup` that
 * owns the value and the roving focus. Kajay draws each choice independently, because a
 * choice list is built from a model that also has to serve matrices, image pickers and
 * ratings, where the group is a row or a scale rather than a component.
 *
 * So a real adapter would have to invert the rendering: the library would need to hand out
 * the *group*, not the item. That is a genuine gap in the primitive set rather than a
 * shortcoming of either library — and it is exactly the sort of thing that only shows up
 * when somebody tries. Recorded rather than papered over; the native radio the default
 * supplies is styled by the token contract in the meantime.
 */
export const KAJAY_SURVEY_COMPONENTS: SurveyComponents = {
  Button,
  Input,
  Textarea,
  Checkbox,
};
