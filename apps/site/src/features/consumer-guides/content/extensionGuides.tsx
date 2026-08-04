import type { GuideSectionDefinition } from '../components/GuideContent';
import { GuideNote, ResponsibilityList } from '../components/GuideContent';
import {
  CUSTOM_LOGIC,
  CUSTOM_PROPERTY,
  CUSTOM_QUESTION,
  SURVEY_COMPONENTS,
} from '../examples/consumerExamples';

export const themeSections: readonly GuideSectionDefinition[] = [
  {
    id: 'use-theme-tokens',
    title: 'Use theme tokens',
    body: <p>Import <code>@kajay/themes/styles.css</code> for the shipped structure and token defaults. Add a preset or override <code>--kajay-*</code> custom properties in your application scope for color, spacing, radius, and typography.</p>,
  },
  {
    id: 'replace-primitives',
    title: 'Replace design-system primitives',
    body: <p>Use the component map when controls must be your application&rsquo;s actual components rather than Kajay controls with different CSS.</p>,
    code: SURVEY_COMPONENTS,
    codeLabel: 'A partial component map',
  },
  {
    id: 'preserve-behavior',
    title: 'Preserve behavior',
    body: <GuideNote><p>Replacement components must forward ids, refs, ARIA state, keyboard and pointer handlers, and change callbacks. The host owns the accessibility and behavior of substituted primitives.</p></GuideNote>,
  },
];

export const questionExtensionSections: readonly GuideSectionDefinition[] = [
  {
    id: 'register-metadata-first',
    title: 'Register metadata first',
    body: <p>A custom question begins as a registry class with a parent, factory, properties, and any child collections. That one registration drives parsing, serialization, schema generation, and the Creator property grid.</p>,
    code: CUSTOM_QUESTION,
    codeLabel: 'Model and renderer registration',
  },
  {
    id: 'clone-renderers',
    title: 'Clone the renderer registry',
    body: <p>Clone <code>defaultPageElementRenderers</code> for one consumer and register the new renderer there. Do not mutate global defaults or import renderer internals.</p>,
  },
  {
    id: 'add-custom-properties',
    title: 'Add properties to existing types',
    body: <p>Use <code>addProperty</code> when every question or one existing class needs host metadata. Pass the same registry to runtime and Creator so parsing, serialization, and authoring agree.</p>,
    code: CUSTOM_PROPERTY,
    codeLabel: 'A host property on every question',
  },
  {
    id: 'render-the-question-contract',
    title: 'Render the question contract',
    body: <ResponsibilityList><li>Use exported title, error, id-scope, and component helpers rather than inventing parallel semantics.</li><li>Write through the question model so events, logic, read-only state, and validation remain coherent.</li><li>Add contract, unit, and real-browser proofs for new observable behavior.</li></ResponsibilityList>,
  },
];

export const logicExtensionSections: readonly GuideSectionDefinition[] = [
  {
    id: 'custom-validators',
    title: 'Register custom validators',
    body: <p>Subclass <code>Validator</code> for synchronous work or <code>AsyncValidator</code> for a promise. Register the validator as metadata so a JSON definition can name it and the Creator can edit it.</p>,
    code: CUSTOM_LOGIC,
    codeLabel: 'Validator and expression function',
  },
  {
    id: 'custom-functions',
    title: 'Use a host-owned function registry',
    body: <p>Start from <code>createDefaultFunctionRegistry</code>, register synchronous or asynchronous functions, and pass that registry to <code>parseSurvey</code>. Function names are case-insensitive.</p>,
  },
  {
    id: 'extension-boundaries',
    title: 'Keep extensions deterministic',
    body: <GuideNote><p>Return early when an async function has insufficient arguments: expressions run during initial settlement before every answer exists. Avoid process-global registrations where a per-survey registry can express the same behavior.</p></GuideNote>,
  },
];
