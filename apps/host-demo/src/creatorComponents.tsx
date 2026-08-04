import type {
  CreatorButtonProps,
  CreatorCheckboxProps,
  CreatorComponents,
  CreatorInputProps,
  CreatorSelectProps,
  CreatorTextareaProps,
} from '@kajay/creator-react';
import type { ReactElement } from 'react';

/** The host-demo's stand-in for an application's own design-system component map. */
export const HOST_CREATOR_COMPONENTS: CreatorComponents = {
  Button: HostButton,
  Input: HostInput,
  Select: HostSelect,
  Checkbox: HostCheckbox,
  Textarea: HostTextarea,
};

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
