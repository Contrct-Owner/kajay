/// <reference types="@vitest/browser/matchers" />
import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { CreatorComponentsProvider, SurveyCreator } from '@kajay/creator-react';
import type {
  CreatorButtonProps,
  CreatorCheckboxProps,
  CreatorComponents,
  CreatorInputProps,
  CreatorSelectProps,
  CreatorTextareaProps,
} from '@kajay/creator-react';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

const BASIC: SurveyDefinition = {
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'who', title: 'Your name' }] }],
};

function registry(): MetadataRegistry {
  const made = new MetadataRegistry();
  registerBuiltInTypes(made);
  return made;
}

function HostButton({ type = 'button', children, ...props }: CreatorButtonProps): ReactElement {
  return (
    <button type={type} data-host-primitive="button" {...props}>
      {children}
    </button>
  );
}

function HostInput({ value, onValueChange, type = 'text', ...props }: CreatorInputProps): ReactElement {
  return (
    <input
      type={type}
      data-host-primitive="input"
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...props}
    />
  );
}

function HostSelect({ value, options, onValueChange, ...props }: CreatorSelectProps): ReactElement {
  return (
    <select
      data-host-primitive="select"
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function HostCheckbox({ checked, onCheckedChange, ...props }: CreatorCheckboxProps): ReactElement {
  return (
    <input
      type="checkbox"
      data-host-primitive="checkbox"
      checked={checked}
      onChange={(event) => {
        onCheckedChange(event.target.checked);
      }}
      {...props}
    />
  );
}

function HostTextarea({ value, onValueChange, ...props }: CreatorTextareaProps): ReactElement {
  return (
    <textarea
      data-host-primitive="textarea"
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
      {...props}
    />
  );
}

const HOST_COMPONENTS: CreatorComponents = {
  Button: HostButton,
  Input: HostInput,
  Select: HostSelect,
  Checkbox: HostCheckbox,
  Textarea: HostTextarea,
};

test('parity/N1-primitives: the assembly uses host text and selection controls', async () => {
  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} components={HOST_COMPONENTS} />,
  );

  await screen.getByTestId('select-who').click();
  const title = screen.getByLabelText('Title of who');
  await expect.element(title).toHaveAttribute('data-host-primitive', 'input');
  await title.fill('Renamed');
  await expect.element(title).toHaveFocus();

  const type = screen.getByLabelText('Type of who');
  await expect.element(type).toHaveAttribute('data-host-primitive', 'select');
  await type.selectOptions('comment');
  await expect.element(type).toHaveValue('comment');
});

test('parity/N1-primitives: the assembly inherits the provider used by standalone pieces', async () => {
  const screen = await render(
    <CreatorComponentsProvider components={{ Input: HostInput }}>
      <SurveyCreator value={BASIC} registry={registry()} />
    </CreatorComponentsProvider>,
  );

  await screen.getByTestId('select-who').click();
  await expect
    .element(screen.getByLabelText('Title of who'))
    .toHaveAttribute('data-host-primitive', 'input');
});

test('parity/N1-primitives: the JSON editor uses the host textarea contract', async () => {
  const screen = await render(
    <SurveyCreator value={BASIC} registry={registry()} components={HOST_COMPONENTS} />,
  );

  await screen.getByTestId('creator-tab-json').click();
  const definition = screen.getByLabelText('Survey definition');
  await expect.element(definition).toHaveAttribute('data-host-primitive', 'textarea');
  await expect.element(definition).toHaveAttribute('spellcheck', 'false');
  await definition.fill('{');

  await expect.element(definition).toHaveFocus();
  await expect.element(definition).toHaveAttribute('aria-invalid', 'true');
  await expect.element(definition).toHaveAttribute('aria-describedby', 'kajay-json-problem');
  await expect.element(screen.getByTestId('json-apply')).toBeDisabled();
  await expect.element(screen.getByTestId('json-revert')).toBeEnabled();
});

test('parity/L3-primitives: host fields preserve read-only behavior and focus', async () => {
  const made = registry();
  made.addProperty('text', { name: 'lockable', type: 'boolean' });
  made.addProperty('text', {
    name: 'locked',
    type: 'string',
    defaultValue: 'fixed',
    readOnlyIf: '{lockable} = true',
  });
  const screen = await render(
    <SurveyCreator
      value={{
        pages: [
          {
            name: 'p1',
            elements: [
              {
                type: 'text',
                name: 'who',
                isRequired: true,
                requiredIf: '{other} = 1',
                lockable: true,
              },
              { type: 'text', name: 'other' },
            ],
          },
        ],
      }}
      registry={made}
      components={HOST_COMPONENTS}
    />,
  );

  await screen.getByTestId('select-who').click();
  const locked = screen.getByTestId('property-who-locked');
  await expect.element(locked).toHaveAttribute('data-host-primitive', 'input');
  await expect.element(locked).toHaveAttribute('readonly');
  await expect.element(locked).not.toBeDisabled();
  await locked.click();
  await expect.element(locked).toHaveFocus();

  const required = screen.getByTestId('property-who-isRequired');
  await expect.element(required).toHaveAttribute('data-host-primitive', 'checkbox');
  await expect.element(required).toHaveAttribute('aria-disabled', 'true');
  required.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await expect.element(required).toBeChecked();
});
