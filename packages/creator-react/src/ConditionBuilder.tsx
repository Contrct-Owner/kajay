import { CONDITION_OPERATORS, isUnaryOperator } from '@kajay/creator-core';
import type { Condition, ConditionTerm, LogicRule, LogicSession } from '@kajay/creator-core';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';

interface BuilderProps {
  readonly session: LogicSession;
  readonly rule: LogicRule;
  readonly condition: Condition;
}

/**
 * The condition as a table of dropdowns.
 *
 * Every change rebuilds the whole condition and writes it once, through core's printer:
 * there is no partial state to be in, and the expression in the definition is always one a
 * designer could have typed.
 */
export function ConditionBuilder({
  session,
  rule,
  condition,
}: BuilderProps): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();
  const write = (terms: readonly ConditionTerm[]): void => {
    session.setCondition(rule, { terms, join: condition.join });
  };

  return (
    <div className="kajay-logic__condition">
      {condition.terms.length > 1 ? (
        <JoinPicker session={session} rule={rule} condition={condition} />
      ) : null}
      {condition.terms.map((term, index) => (
        <TermRow
          key={`${rule.id}-${String(index)}`}
          session={session}
          rule={rule}
          term={term}
          index={index}
          onChange={(next) => {
            write(condition.terms.map((existing, at) => (at === index ? next : existing)));
          }}
          onRemove={() => {
            write(condition.terms.filter((_unused, at) => at !== index));
          }}
        />
      ))}
      <Button
        className="kajay-logic__add-term"
        data-testid={`logic-add-term-${rule.id}`}
        onClick={() => {
          const first = session.subjects[0] ?? '';
          write([...condition.terms, { left: first, operator: 'notempty', right: '' }]);
        }}
      >
        {text('logicAddCondition')}
      </Button>
    </div>
  );
}

interface TermRowProps {
  readonly session: LogicSession;
  readonly rule: LogicRule;
  readonly term: ConditionTerm;
  readonly index: number;
  readonly onChange: (term: ConditionTerm) => void;
  readonly onRemove: () => void;
}

/**
 * One comparison: question, operator, value.
 *
 * The value cell is a **picker when the question has choices and a field when it does not**
 * — read off the model, so it works for a host's own select type and stops offering stale
 * options the moment carry-forward makes the choices somebody else's.
 */
function TermRow({ session, rule, term, index, onChange, onRemove }: TermRowProps): ReactElement {
  const { Button, Select } = useCreatorComponents();
  const id = `${rule.id}-${String(index)}`;
  const choices = session.choicesFor(term.left);

  return (
    <div className="kajay-logic__term" data-testid={`logic-term-${id}`}>
      <Select
        className="kajay-logic__question"
        aria-label={`Question of condition ${String(index + 1)}`}
        data-testid={`logic-left-${id}`}
        value={term.left}
        options={session.subjects.map((name) => ({ value: name, label: name }))}
        onValueChange={(left) => {
          onChange({ ...term, left });
        }}
      />
      <Select
        className="kajay-logic__operator"
        aria-label={`Operator of condition ${String(index + 1)}`}
        data-testid={`logic-operator-${id}`}
        value={term.operator}
        options={CONDITION_OPERATORS.map((operator) => ({ value: operator, label: operator }))}
        onValueChange={(operator) => {
          const chosen = CONDITION_OPERATORS.find((candidate) => candidate === operator);
          if (chosen !== undefined) {
            // The value is carried across unconditionally, and it does not need clearing:
            // the printed expression drops it for `empty` and `notempty`, and the row is
            // re-derived from the definition on the next render, so a value the comparison
            // ignores cannot outlive the write. A first version cleared it here and a
            // mutant proved the clearing could never be observed.
            onChange({ ...term, operator: chosen });
          }
        }}
      />
      <ValueCell term={term} index={index} id={id} choices={choices} onChange={onChange} />
      <Button
        className="kajay-logic__remove-term"
        aria-label={`Remove condition ${String(index + 1)}`}
        data-testid={`logic-remove-term-${id}`}
        onClick={onRemove}
      >
        ×
      </Button>
    </div>
  );
}


/**
 * How the terms combine, when there is more than one.
 *
 * Words rather than the operators: "all of these" is what `and` means to somebody who has
 * not written an expression before, and the operator is still there in the JSON tab for
 * somebody who has.
 */
function JoinPicker({ session, rule, condition }: BuilderProps): ReactElement {
  const { Select } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <Select
      className="kajay-logic__join"
      aria-label={`How the conditions of ${rule.id} combine`}
      data-testid={`logic-join-${rule.id}`}
      value={condition.join}
      options={[
        { value: 'and', label: text('logicAll') },
        { value: 'or', label: text('logicAny') },
      ]}
      onValueChange={(join) => {
        session.setCondition(rule, {
          terms: condition.terms,
          join: join === 'or' ? 'or' : 'and',
        });
      }}
    />
  );
}

/**
 * What the question is compared against.
 *
 * A **picker when the question has choices and a field when it does not**, read off the
 * model rather than off a type name — so it works for a host's own select type, and stops
 * offering options the moment carry-forward makes the choices somebody else's. Nothing at
 * all for `empty` and `notempty`, which take no value.
 */
function ValueCell({
  term,
  index,
  id,
  choices,
  onChange,
}: {
  readonly term: ConditionTerm;
  readonly index: number;
  readonly id: string;
  readonly choices: readonly string[];
  readonly onChange: (term: ConditionTerm) => void;
}): ReactElement | null {
  const { Input, Select } = useCreatorComponents();
  const label = `Value of condition ${String(index + 1)}`;

  if (isUnaryOperator(term.operator)) {
    return null;
  }
  if (choices.length > 0) {
    return (
      <Select
        className="kajay-logic__value"
        aria-label={label}
        data-testid={`logic-value-${id}`}
        value={term.right}
        options={choices.map((choice) => ({ value: choice, label: choice }))}
        onValueChange={(right) => {
          onChange({ ...term, right });
        }}
      />
    );
  }
  return (
    <Input
      className="kajay-logic__value"
      aria-label={label}
      data-testid={`logic-value-${id}`}
      value={term.right}
      onValueChange={(right) => {
        onChange({ ...term, right });
      }}
    />
  );
}
