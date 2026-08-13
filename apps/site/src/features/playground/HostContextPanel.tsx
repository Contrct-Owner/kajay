import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PLAYGROUND_TIERS, type PlaygroundHostValues } from './playgroundHostValues';

// Colours stated rather than inherited. A native control left transparent takes its text
// from the user agent, which in a dark theme is the browser's idea of black on the card's
// idea of dark — a real contrast failure, and one only Firefox reported.
const FIELD =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background text-foreground ' +
  'px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] ' +
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** What every control here needs: the values in force, and somewhere to send a change. */
interface HostValueControl {
  readonly values: PlaygroundHostValues;
  readonly onChange: (values: PlaygroundHostValues) => void;
}

/** One labelled control, captioned with the reference an expression would write. */
function Field({
  id,
  reference,
  children,
}: {
  readonly id: string;
  readonly reference: string;
  readonly children: ReactElement;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>
        <code className="font-mono">{reference}</code>
      </Label>
      {children}
    </div>
  );
}

/** The plan the application says this account is on. */
function TierField({ values, onChange }: HostValueControl): ReactElement {
  return (
    <Field id="host-tier" reference="{$tier}">
      <select
        id="host-tier"
        className={FIELD}
        data-testid="host-tier"
        value={values.tier}
        onChange={(event) => {
          onChange({ ...values, tier: event.target.value });
        }}
      >
        {PLAYGROUND_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {tier}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** A number the survey computes with, to show the scope is not only for conditions. */
function SeatsField({ values, onChange }: HostValueControl): ReactElement {
  return (
    <Field id="host-seats" reference="{$seats}">
      <input
        id="host-seats"
        type="number"
        min={1}
        className={FIELD}
        data-testid="host-seats"
        value={values.seats}
        onChange={(event) => {
          const seats = Math.trunc(Number(event.target.value));
          onChange({ ...values, seats: Number.isNaN(seats) ? 0 : seats });
        }}
      />
    </Field>
  );
}

/**
 * The application's own context, drawn as the application's own chrome — checklist B12.
 *
 * **Deliberately not part of the designer.** A host value is the one thing in a survey a
 * definition cannot author: it comes from the session, the CRM, the entitlement service.
 * Putting these fields among the authoring controls would teach exactly the wrong lesson —
 * that host context is something a designer writes — so the panel sits with the respondent
 * pane, under a heading that says whose values these are.
 *
 * Native controls rather than the site's own select: this is a stand-in for a host's UI,
 * not survey furniture, and a plain labelled control is the accessible default without any
 * of the interaction a portalled listbox brings with it.
 */
export function HostContextPanel({
  values,
  onChange,
  onLoadExample,
}: HostValueControl & { readonly onLoadExample: () => void }): ReactElement {
  return (
    <section
      className="bg-card ring-border min-w-0 overflow-hidden rounded-xl shadow-sm ring-1"
      aria-label="Host context"
    >
      <div className="bg-muted/40 border-border border-b px-4 py-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Host context — your application, not your survey
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-4 p-5">
        <p className="text-muted-foreground text-sm">
          Your application supplies these; a definition cannot author them. Expressions read
          them as <code className="font-mono">{'{$name}'}</code>. They never reach the
          response, and the survey reacts without restarting.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TierField values={values} onChange={onChange} />
          <SeatsField values={values} onChange={onChange} />
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          data-testid="host-load-example"
          onClick={onLoadExample}
        >
          Load a survey that reads them
        </Button>
      </div>
    </section>
  );
}
