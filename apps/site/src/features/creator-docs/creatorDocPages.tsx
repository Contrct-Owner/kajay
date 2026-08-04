import type { DocPageDefinition } from '@/features/docs-shell';
import { CreatorCompositionGuide } from './content/CreatorCompositionGuide';
import { CreatorConfigurationGuide } from './content/CreatorConfigurationGuide';
import { CreatorCustomizationGuide } from './content/CreatorCustomizationGuide';
import { CreatorFeedbackGuide } from './content/CreatorFeedbackGuide';
import { CreatorPersistenceGuide } from './content/CreatorPersistenceGuide';
import { CreatorQuickstart } from './content/CreatorQuickstart';

export const creatorDocPages = [
  {
    slug: 'quickstart/creator',
    title: 'Embed the Creator',
    description: 'Open a survey definition in Kajay’s default React Creator and keep it in application state.',
    section: 'Start',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'create-a-controlled-creator', label: 'Create a controlled Creator', depth: 2 },
      { id: 'what-the-creator-owns', label: 'What the Creator owns', depth: 2 },
      { id: 'next-steps', label: 'Next steps', depth: 2 },
    ],
    content: <CreatorQuickstart />,
  },
  {
    slug: 'creator/definitions-and-saving',
    title: 'Load and save definitions',
    description: 'Connect the controlled Creator definition to storage owned by your application.',
    section: 'Creator',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'load-a-definition', label: 'Load a definition', depth: 2 },
      { id: 'save-a-definition', label: 'Save a definition', depth: 2 },
      { id: 'autosave-behavior', label: 'Autosave behavior', depth: 2 },
      { id: 'incoming-changes', label: 'Incoming changes and conflicts', depth: 2 },
    ],
    content: <CreatorPersistenceGuide />,
  },
  {
    slug: 'creator/configuration',
    title: 'Configure a Creator deployment',
    description: 'Restrict tabs, question types, editing, and property-grid presentation for one deployment.',
    section: 'Creator',
    status: 'preview',
    audience: 'consumer',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'configure-the-default-assembly', label: 'Configure the default assembly', depth: 2 },
      { id: 'configure-the-property-grid', label: 'Configure the property grid', depth: 2 },
      { id: 'workspace-lifetime', label: 'Workspace lifetime', depth: 2 },
    ],
    content: <CreatorConfigurationGuide />,
  },
  {
    slug: 'creator/composition',
    title: 'Default Creator or composed pieces',
    description: 'Choose the maintained assembly or arrange the same public panels inside your product layout.',
    section: 'Creator',
    status: 'preview',
    audience: 'extension',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'start-with-survey-creator', label: 'Start with SurveyCreator', depth: 2 },
      { id: 'compose-the-pieces', label: 'Compose the pieces', depth: 2 },
      { id: 'share-one-workspace', label: 'Share one workspace', depth: 2 },
      { id: 'composition-responsibilities', label: 'Composition responsibilities', depth: 2 },
    ],
    content: <CreatorCompositionGuide />,
  },
  {
    slug: 'creator/customization',
    title: 'Customize Creator UI',
    description: 'Use your design system, vocabulary, theme, and property editors without forking Kajay.',
    section: 'Creator',
    status: 'preview',
    audience: 'extension',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'use-design-system-components', label: 'Use design-system components', depth: 2 },
      { id: 'customize-words-and-theme', label: 'Customize words and theme', depth: 2 },
      { id: 'replace-a-property-editor', label: 'Replace a property editor', depth: 2 },
    ],
    content: <CreatorCustomizationGuide />,
  },
  {
    slug: 'creator/notices-and-refusals',
    title: 'Notices and refused edits',
    description: 'Tell designers why an edit did not happen and what Kajay changed automatically.',
    section: 'Creator',
    status: 'preview',
    audience: 'extension',
    sdk: 'typescript',
    framework: 'react',
    toc: [
      { id: 'refused-edits', label: 'Refused edits', depth: 2 },
      { id: 'creator-notices', label: 'Creator notices', depth: 2 },
      { id: 'handle-feedback-in-custom-ui', label: 'Handle feedback in custom UI', depth: 2 },
      { id: 'when-to-use-each', label: 'When to use each', depth: 2 },
    ],
    content: <CreatorFeedbackGuide />,
  },
] as const satisfies readonly DocPageDefinition[];

