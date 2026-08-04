export const CREATOR_QUICKSTART = `import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';
import '@kajay/themes/styles.css';
import { useState } from 'react';

const initialDefinition: SurveyDefinition = {
  title: 'Customer feedback',
  pages: [
    {
      name: 'feedback',
      elements: [
        { type: 'text', name: 'name', title: 'Your name' },
        {
          type: 'rating',
          name: 'rating',
          title: 'How was your experience?',
        },
      ],
    },
  ],
};

export function SurveyBuilder() {
  const [definition, setDefinition] =
    useState<SurveyDefinition>(initialDefinition);

  return (
    <SurveyCreator
      value={definition}
      onChange={setDefinition}
    />
  );
}`;

export const CREATOR_SAVE = `import type { SurveyDefinition } from '@kajay/core';
import { SurveyCreator } from '@kajay/creator-react';

async function saveDefinition(
  definition: SurveyDefinition,
): Promise<boolean> {
  const response = await fetch('/api/surveys/customer-feedback', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(definition),
  });

  return response.ok;
}

<SurveyCreator
  value={definition}
  onChange={setDefinition}
  save={saveDefinition}
  isAutoSave
/>`;

export const CREATOR_LOAD = `const [definition, setDefinition] =
  useState<SurveyDefinition>(initialDefinition);

async function openSurvey(id: string): Promise<void> {
  const response = await fetch('/api/surveys/' + id);
  const next = (await response.json()) as SurveyDefinition;
  setDefinition(next);
}

<SurveyCreator
  value={definition}
  onChange={setDefinition}
/>`;

export const CREATOR_CONFIGURATION = `import type { SurveyCreatorProps } from '@kajay/creator-react';

const deployment = {
  tabs: ['design', 'preview', 'logic'],
  configuration: {
    allowedTypes: ['text', 'comment', 'radiogroup'],
    blockedTypes: ['file'],
    grid: {
      hidden: ['visibleIf', 'enableIf'],
      titles: { colCount: 'Columns' },
      order: ['title', 'name', 'isRequired'],
    },
  },
} satisfies Pick<SurveyCreatorProps, 'tabs' | 'configuration'>;

<SurveyCreator
  value={definition}
  onChange={setDefinition}
  {...deployment}
/>`;

export const CREATOR_WORKSPACE = `import { useCreatorWorkspace } from '@kajay/creator-react';

function RestrictedCreator({ definition, tenantId }) {
  const workspace = useCreatorWorkspace({
    definition,
    configuration: {
      allowedTypes: ['text', 'comment'],
      isReadOnly: false,
    },
  });

  return <MyCreatorLayout workspace={workspace} />;
}

// Configuration is fixed for a workspace lifetime. If the tenant's
// deployment changes, remount it as a different workspace:
<RestrictedCreator key={tenantId} tenantId={tenantId} definition={definition} />`;

export const DEFAULT_CREATOR = `import { SurveyCreator } from '@kajay/creator-react';

<SurveyCreator
  value={definition}
  onChange={setDefinition}
  save={saveDefinition}
  tabs={['design', 'preview', 'logic', 'json']}
/>`;

export const COMPOSED_CREATOR = `import {
  CreatorNotices,
  DesignSurfacePanel,
  HistoryPanel,
  PageNavigatorPanel,
  PreviewPanel,
  PropertyGridPanel,
  ToolboxPanel,
  useCreatorDocument,
  useCreatorWorkspace,
  useDesignerPlacement,
} from '@kajay/creator-react';

function ComposedCreator({ value, onChange }) {
  const workspace = useCreatorWorkspace({ definition: value });
  useCreatorDocument({ surface: workspace.surface, value, onChange });
  const placement = useDesignerPlacement(workspace.surface);

  return (
    <div className="creator-layout">
      <CreatorNotices surface={workspace.surface} />
      <aside>
        <ToolboxPanel
          toolbox={workspace.toolbox}
          getItemProps={placement.getItemProps}
        />
      </aside>
      <main>
        <HistoryPanel surface={workspace.surface} />
        <PageNavigatorPanel
          surface={workspace.surface}
          placement={placement}
        />
        <DesignSurfacePanel
          surface={workspace.surface}
          placement={placement}
        />
      </main>
      <PropertyGridPanel surface={workspace.surface} />
      <PreviewPanel session={workspace.preview} />
    </div>
  );
}`;

export const CREATOR_COMPONENTS = `import type { CreatorComponents } from '@kajay/creator-react';

const creatorComponents = {
  Button: DesignSystemButton,
  Input: DesignSystemInput,
  Select: DesignSystemSelect,
  Checkbox: DesignSystemCheckbox,
  Textarea: DesignSystemTextarea,
  Menu: DesignSystemMenu,
} satisfies CreatorComponents;

<SurveyCreator
  value={definition}
  onChange={setDefinition}
  components={creatorComponents}
  surveyComponents={surveyComponents}
/>`;

export const CREATOR_STRINGS = `import { CreatorStringDictionary } from '@kajay/creator-core';

const strings = new CreatorStringDictionary();
strings.register('en', {
  tabDesign: 'Build',
  tabPreview: 'Try it',
  addPage: 'Add a section',
  toolboxSearch: 'Find a field',
});

<SurveyCreator
  value={definition}
  onChange={setDefinition}
  strings={strings}
  locale="en"
  creatorTheme={{ '--kajay-color-accent': '#6d28d9' }}
/>`;

export const PROPERTY_EDITOR = `import {
  PropertyEditorProvider,
  useCreatorComponents,
} from '@kajay/creator-react';
import type {
  PropertyEditorProps,
  PropertyEditorResolver,
} from '@kajay/creator-react';

function TitleLocationEditor(props: PropertyEditorProps) {
  const { Select } = useCreatorComponents();
  const { surface, element, row, id, hint, testId } = props;

  return (
    <Select
      id={id}
      aria-describedby={hint}
      data-testid={testId}
      value={typeof row.value === 'string' ? row.value : 'default'}
      options={['default', 'top', 'left', 'hidden'].map((value) => ({
        value,
        label: value,
      }))}
      onValueChange={(value) => {
        surface.setProperty(element, row.name, value);
      }}
    />
  );
}

const resolveEditor: PropertyEditorResolver = (row) =>
  row.name === 'titleLocation' ? TitleLocationEditor : undefined;

<PropertyEditorProvider resolve={resolveEditor}>
  <SurveyCreator value={definition} onChange={setDefinition} />
</PropertyEditorProvider>`;

export const CREATOR_NOTICE = `import {
  CreatorNotices,
  useCreatorText,
} from '@kajay/creator-react';
import { refusalMessageKey } from '@kajay/creator-core';

// Include this once in a composed Creator. SurveyCreator already does.
<CreatorNotices surface={workspace.surface} />

function RenameButton({ surface, question, nextName }) {
  const text = useCreatorText();

  function rename(): void {
    const refusal = surface.setProperty(question, 'name', nextName);
    if (refusal !== undefined) {
      announce(text(refusalMessageKey(refusal.kind), refusal.subject ?? ''));
    }
  }

  return <button onClick={rename}>Rename</button>;
}`;
