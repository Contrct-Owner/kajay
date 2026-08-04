import { LOGIC_TEMPLATES } from '@kajay/creator-core';
import { ConditionBuilder } from './ConditionBuilder.js';
import type {
  CreatorStringKey,
  LogicRule,
  LogicRuleTemplate,
  LogicSession,
} from '@kajay/creator-core';
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import type { CreatorText } from './CreatorStringsContext.js';

export interface LogicPanelProps {
  readonly session: LogicSession;
  readonly className?: string;
}

/** The catalogue key each action is named by — checklist N3. */
const ACTION_KEYS: Readonly<Record<string, CreatorStringKey | undefined>> = {
  show: 'actionShow',
  enable: 'actionEnable',
  require: 'actionRequire',
  setValue: 'actionSetValue',
  clearValue: 'actionClearValue',
  skip: 'actionSkip',
  complete: 'actionComplete',
  copyValue: 'actionCopyValue',
  runExpression: 'actionRunExpression',
};

/** An action the catalogue has never heard of is named by its own key, not by nothing. */
function actionTitle(text: CreatorText, action: string): string {
  const key = ACTION_KEYS[action];
  return key === undefined ? action : text(key);
}

/**
 * Every rule in the survey, listed and built from dropdowns — checklist M1.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the session
 * and holds nothing but which template an "add" picker is on.
 *
 * **A rule whose condition the builder cannot say keeps its text.** That is the whole shape
 * of this panel: dropdowns where they are honest, a text field where they would be a lie,
 * and never a silent rewrite in between.
 */
export function LogicPanel({ session, className }: LogicPanelProps): ReactElement {
  useLogicVersion(session);
  const text = useCreatorText();
  const rules = session.rules;

  return (
    <div className={joinClasses('kajay-logic', className)}>
      <AddRule session={session} />
      {rules.length === 0 ? (
        <p className="kajay-logic__empty">{text('logicEmpty')}</p>
      ) : (
        <ul className="kajay-logic__rules" data-testid="logic-rules">
          {rules.map((rule) => (
            <RuleRow key={rule.id} session={session} rule={rule} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One rule: what it does, when, and the means to stop it doing it. */
function RuleRow({
  session,
  rule,
}: {
  readonly session: LogicSession;
  readonly rule: LogicRule;
}): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <li className="kajay-logic__rule" data-testid={`logic-rule-${rule.id}`}>
      <p className="kajay-logic__action">
        <strong>{actionTitle(text, rule.action)}</strong>{' '}
        {rule.action === 'complete' ? '' : rule.argument.length > 0 ? rule.argument : rule.subject}
        {` ${text('logicWhen')}`}
      </p>
      {rule.condition === undefined ? (
        <RawCondition session={session} rule={rule} />
      ) : (
        <ConditionBuilder session={session} rule={rule} condition={rule.condition} />
      )}
      <Button
        className="kajay-logic__remove"
        data-testid={`logic-remove-${rule.id}`}
        onClick={() => {
          session.removeRule(rule);
        }}
      >
        {text('logicRemoveRule')}
      </Button>
    </li>
  );
}

/**
 * The fallback: an expression the dropdowns cannot represent, as text.
 *
 * Shown rather than hidden, and **editable rather than read-only**. A designer who has
 * written `({a} = 1 or {b} = 2) and {c} notempty` still needs to change it, and taking the
 * field away would mean the logic tab silently owned less of the survey than it listed.
 */
function RawCondition({
  session,
  rule,
}: {
  readonly session: LogicSession;
  readonly rule: LogicRule;
}): ReactElement {
  const { Input } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <div className="kajay-logic__raw">
      <label className="kajay-logic__label" htmlFor={`logic-raw-${rule.id}`}>
        {text('logicCondition')}
      </label>
      <Input
        className="kajay-logic__input"
        id={`logic-raw-${rule.id}`}
        data-testid={`logic-raw-${rule.id}`}
        value={rule.conditionText}
        onValueChange={(value) => {
          session.setConditionText(rule, value);
        }}
      />
      <p className="kajay-logic__note" data-testid={`logic-raw-note-${rule.id}`}>
        {text('logicRawNote')}
      </p>
    </div>
  );
}

/** Adding a rule: what it should do, and to what. */
function AddRule({ session }: { readonly session: LogicSession }): ReactElement {
  const { Button, Select } = useCreatorComponents();
  const text = useCreatorText();
  const [action, setAction] = useState(LOGIC_TEMPLATES[0]?.action ?? 'show');
  const [subject, setSubject] = useState('');
  const template = LOGIC_TEMPLATES.find((candidate) => candidate.action === action);
  const chosen = subject.length > 0 ? subject : (session.subjects[0] ?? '');

  return (
    <div className="kajay-logic__add">
      <Select
        className="kajay-logic__new-action"
        aria-label={text('logicNewAction')}
        data-testid="logic-new-action"
        value={action}
        options={LOGIC_TEMPLATES.map((candidate) => ({
          value: candidate.action,
          label: actionTitle(text, candidate.action),
        }))}
        onValueChange={(next) => {
          setAction(next as LogicRuleTemplate['action']);
        }}
      />
      {template?.property === undefined ? null : (
        <Select
          className="kajay-logic__new-subject"
          aria-label={text('logicNewSubject')}
          data-testid="logic-new-subject"
          value={chosen}
          options={session.subjects.map((name) => ({ value: name, label: name }))}
          onValueChange={setSubject}
        />
      )}
      <Button
        className="kajay-logic__add-rule"
        data-testid="logic-add-rule"
        disabled={template === undefined}
        onClick={() => {
          if (template !== undefined) {
            session.addRule(template, chosen);
          }
        }}
      >
        {text('logicAddRule')}
      </Button>
    </div>
  );
}

/** Re-renders when the survey changes, which is the only thing a rule list depends on. */
export function useLogicVersion(session: LogicSession): number {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => session.onChanged.add(onStoreChange),
    [session],
  );
  const getSnapshot = useCallback((): number => session.version, [session]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

function joinClasses(base: string, extra: string | undefined): string {
  return extra === undefined || extra.length === 0 ? base : `${base} ${extra}`;
}
